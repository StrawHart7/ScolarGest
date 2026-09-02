import { createClient } from '@/lib/supabase/server';
import { requireRole } from './authorization';
import { auditLog } from './audit';
import { generateMatriculeEnseignant } from './matricule';
import { inviteUtilisateur } from './utilisateur';
import { createMatiere } from './matiere';
import { lireClasseur, type LigneBrute } from '@/lib/import/excel';
import { analyserEntetes } from '@/lib/import/entetes';
import type { AnalyseImport, LigneAnalysee } from '@/lib/import/analyse';
import {
  ENSEIGNANT_IMPORT_COLUMNS,
  enseignantImportLigneSchema,
  type EnseignantImportLigne,
  type LigneErreur,
} from '@/lib/import/enseignant-import-schema';

export type { LigneBrute };

export interface ValidationResult {
  valides: { ligne: number; data: EnseignantImportLigne }[];
  erreurs: LigneErreur[];
}

export function validerLignes(lignes: LigneBrute[]): ValidationResult {
  const valides: ValidationResult['valides'] = [];
  const erreurs: LigneErreur[] = [];

  for (const { ligne, valeurs } of lignes) {
    const normalized: Record<string, unknown> = {};
    for (const col of ENSEIGNANT_IMPORT_COLUMNS) {
      const raw = valeurs[col];
      normalized[col] = typeof raw === 'string' ? raw.trim() : raw;
    }

    const parsed = enseignantImportLigneSchema.safeParse(normalized);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        erreurs.push({
          ligne,
          champ: String(issue.path[0] ?? '?'),
          message: issue.message,
        });
      }
      continue;
    }
    valides.push({ ligne, data: parsed.data });
  }

  return { valides, erreurs };
}

export interface ImportRapportLigne {
  ligne: number;
  ok: boolean;
  message: string;
  enseignantId?: string;
}

export interface ImportRapport {
  totalLignes: number;
  succes: number;
  echecs: number;
  details: ImportRapportLigne[];
  erreursValidation: LigneErreur[];
}

interface AffectationResolue {
  ligne: number;
  classeId: string;
  matiereId: string;
}

interface GroupeEnseignant {
  cle: string; // email en minuscules, identifiant "métier" du groupe
  premiere: { ligne: number; data: EnseignantImportLigne };
  lignes: { ligne: number; data: EnseignantImportLigne }[];
}

/**
 * Importe les lignes déjà validées, groupées par enseignant (email en
 * minuscules, une ligne = un enseignant + une affectation). Pour chaque
 * groupe :
 *  1. résout classeId (dans l'année scolaire cible) et matiereId (par nom,
 *     scope établissement, auto-création si la matière n'existe pas encore —
 *     plus tolérant pour un import en masse, une matière n'a pas de champs
 *     complexes à ce stade du produit) pour chaque ligne du groupe ;
 *  2. si aucune ligne du groupe n'est résolvable, l'enseignant n'est pas créé
 *     (pas d'enseignant orphelin sans affectation) — chaque ligne rapporte
 *     son propre échec ;
 *  3. sinon, provisionne le compte (inviteUtilisateur, hors transaction SQL
 *     — Admin API), génère le matricule, puis crée l'enseignant + toutes ses
 *     affectations résolues en un seul appel RPC transactionnel
 *     (fn_creer_enseignant_avec_affectations) : soit tout réussit, soit tout
 *     est annulé (y compris la ligne enseignant), pour ce groupe.
 * Un groupe en échec n'empêche pas le traitement des groupes suivants. Un
 * seul auditLog récapitulatif est posé à la fin.
 */
export async function importerLignesValides(
  lignesValides: { ligne: number; data: EnseignantImportLigne }[],
  anneeScolaireId: string,
): Promise<ImportRapport> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE');
  const supabase = createClient();

  const { data: classes, error: classesError } = await supabase
    .from('classe')
    .select('id, nom')
    .eq('etablissementId', ctx.etablissementId)
    .eq('anneeScolaireId', anneeScolaireId);
  if (classesError) throw classesError;
  const classeParNom = new Map((classes ?? []).map((c) => [c.nom.trim().toLowerCase(), c.id]));

  const { data: matieres, error: matieresError } = await supabase
    .from('matiere')
    .select('id, nom')
    .eq('etablissementId', ctx.etablissementId);
  if (matieresError) throw matieresError;
  const matiereParNom = new Map((matieres ?? []).map((m) => [m.nom.trim().toLowerCase(), m.id]));

  // Groupement par email (insensible à la casse), en conservant l'ordre
  // d'apparition dans le fichier.
  const groupes = new Map<string, GroupeEnseignant>();
  for (const item of lignesValides) {
    const cle = item.data.email.trim().toLowerCase();
    const groupe = groupes.get(cle);
    if (groupe) {
      groupe.lignes.push(item);
    } else {
      groupes.set(cle, { cle, premiere: item, lignes: [item] });
    }
  }

  const details: ImportRapportLigne[] = [];

  for (const groupe of groupes.values()) {
    const affectationsResolues: AffectationResolue[] = [];
    const echecsLocaux: ImportRapportLigne[] = [];

    for (const { ligne, data } of groupe.lignes) {
      const classeId = classeParNom.get(data.classe.trim().toLowerCase());
      if (!classeId) {
        echecsLocaux.push({
          ligne,
          ok: false,
          message: `Classe "${data.classe}" introuvable pour l'année scolaire ciblée`,
        });
        continue;
      }

      let matiereId = matiereParNom.get(data.matiere.trim().toLowerCase());
      if (!matiereId) {
        try {
          const nouvelleMatiere = await createMatiere({ nom: data.matiere.trim() });
          matiereId = nouvelleMatiere.id;
          matiereParNom.set(data.matiere.trim().toLowerCase(), matiereId);
        } catch (e) {
          echecsLocaux.push({
            ligne,
            ok: false,
            message:
              e instanceof Error
                ? `Impossible de créer la matière "${data.matiere}": ${e.message}`
                : `Impossible de créer la matière "${data.matiere}"`,
          });
          continue;
        }
      }

      affectationsResolues.push({ ligne, classeId, matiereId });
    }

    if (affectationsResolues.length === 0) {
      // Aucune affectation résolvable pour ce groupe : pas d'enseignant créé.
      details.push(...echecsLocaux);
      continue;
    }

    try {
      const { data: donneesEnseignant } = groupe.premiere;
      const matricule = await generateMatriculeEnseignant(anneeScolaireId);

      const utilisateur = await inviteUtilisateur({
        email: donneesEnseignant.email,
        nom: donneesEnseignant.nom,
        prenom: donneesEnseignant.prenoms,
        role: 'ENSEIGNANT',
        etablissementId: ctx.etablissementId,
      });

      const { data: enseignantId, error: rpcError } = await supabase.rpc(
        'fn_creer_enseignant_avec_affectations',
        {
          p_etablissement_id: ctx.etablissementId,
          p_utilisateur_id: utilisateur.id,
          p_enseignant: {
            matricule,
            ancienMatricule: donneesEnseignant.matricule_ancien || undefined,
            nom: donneesEnseignant.nom,
            prenoms: donneesEnseignant.prenoms,
            sexe: donneesEnseignant.sexe,
            dateNaissance: donneesEnseignant.date_naissance || undefined,
            telephone: donneesEnseignant.telephone || undefined,
            email: donneesEnseignant.email,
            dateEmbauche: donneesEnseignant.date_embauche || undefined,
          },
          p_affectations: affectationsResolues.map((a) => ({
            anneeScolaireId,
            classeId: a.classeId,
            matiereId: a.matiereId,
          })),
        },
      );
      if (rpcError) throw rpcError;

      for (const { ligne } of affectationsResolues) {
        details.push({ ligne, ok: true, message: 'Importé avec succès', enseignantId: enseignantId as string });
      }
      details.push(...echecsLocaux);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erreur inconnue lors de l'import";
      for (const { ligne } of affectationsResolues) {
        details.push({ ligne, ok: false, message });
      }
      details.push(...echecsLocaux);
    }
  }

  details.sort((a, b) => a.ligne - b.ligne);

  const succes = details.filter((d) => d.ok).length;
  const echecs = details.length - succes;

  await auditLog({
    action: 'IMPORT_ENSEIGNANTS',
    module: 'enseignants',
    objetType: 'ImportEnseignants',
    nouvelleValeur: { anneeScolaireId, totalLignes: details.length, succes, echecs },
  });

  return { totalLignes: details.length, succes, echecs, details, erreursValidation: [] };
}

/**
 * Analyse un fichier d'enseignants sans rien ecrire.
 *
 * Deux limites assumees, differentes de l'import des eleves :
 *
 * - **Pas de detection de doublons.** L'identite d'un enseignant est son email,
 *   et `inviteUtilisateur` refuse deja un email deja pris — le refus est donc
 *   bruyant, la ou un eleve duplique passait en silence.
 * - **Une matiere inconnue ne bloque pas.** L'import la cree, deliberement
 *   (voir `importerLignesValides`). La marquer refusee ici mentirait sur ce qui
 *   va se passer.
 *
 * La classe, elle, est resolue des l'analyse : c'est le refus le plus frequent,
 * et le decouvrir apres ecriture n'a aucun interet.
 */
export async function preparerImportEnseignants(
  buffer: ArrayBuffer | Buffer,
  anneeScolaireId: string,
): Promise<{
  analyse: AnalyseImport;
  aEcrire: { ligne: number; data: EnseignantImportLigne }[];
}> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE');
  const supabase = createClient();

  const { entetes, lignes: lignesBrutes } = lireClasseur(buffer);
  const analyseEntetes = analyserEntetes(entetes, ENSEIGNANT_IMPORT_COLUMNS);
  if (!analyseEntetes.conforme) {
    return {
      analyse: {
        entetes: analyseEntetes,
        totalLignes: lignesBrutes.length,
        lignes: [],
        erreursValidation: [],
      },
      aEcrire: [],
    };
  }

  const { valides, erreurs } = validerLignes(lignesBrutes);

  const { data: classes, error: classesError } = await supabase
    .from('classe')
    .select('id, nom')
    .eq('etablissementId', ctx.etablissementId)
    .eq('anneeScolaireId', anneeScolaireId);
  if (classesError) throw classesError;
  const classesConnues = new Set((classes ?? []).map((c) => c.nom.trim().toLowerCase()));

  const lignesAnalysees: LigneAnalysee[] = [];
  const aEcrire: { ligne: number; data: EnseignantImportLigne }[] = [];

  const parLigne = new Map<number, string[]>();
  for (const e of erreurs) {
    const motifs = parLigne.get(e.ligne) ?? [];
    motifs.push(`${e.champ} : ${e.message}`);
    parLigne.set(e.ligne, motifs);
  }
  for (const [ligne, motifs] of parLigne) {
    lignesAnalysees.push({
      ligne,
      statut: 'REFUSEE',
      libelle: `Ligne ${ligne}`,
      motif: motifs.join(' ; '),
    });
  }

  for (const { ligne, data } of valides) {
    const libelle = `${data.nom} ${data.prenoms} — ${data.matiere} (${data.classe})`.trim();
    if (!classesConnues.has(data.classe.trim().toLowerCase())) {
      lignesAnalysees.push({
        ligne,
        statut: 'REFUSEE',
        libelle,
        motif: `Classe « ${data.classe} » introuvable pour l’année scolaire ciblée`,
      });
      continue;
    }
    lignesAnalysees.push({ ligne, statut: 'PRETE', libelle, motif: '' });
    aEcrire.push({ ligne, data });
  }

  lignesAnalysees.sort((a, b) => a.ligne - b.ligne);

  return {
    analyse: {
      entetes: analyseEntetes,
      totalLignes: lignesBrutes.length,
      lignes: lignesAnalysees,
      erreursValidation: erreurs,
    },
    aEcrire,
  };
}

/** Ecrit les lignes retenues par l'analyse. Le fichier est relu cote serveur. */
export async function executerImportEnseignants(
  buffer: ArrayBuffer | Buffer,
  anneeScolaireId: string,
): Promise<{ analyse: AnalyseImport; rapport: ImportRapport }> {
  const { analyse, aEcrire } = await preparerImportEnseignants(buffer, anneeScolaireId);
  if (aEcrire.length === 0) {
    return {
      analyse,
      rapport: { totalLignes: 0, succes: 0, echecs: 0, details: [], erreursValidation: [] },
    };
  }
  const rapport = await importerLignesValides(aEcrire, anneeScolaireId);
  return { analyse, rapport };
}

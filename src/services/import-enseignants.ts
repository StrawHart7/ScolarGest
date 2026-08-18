import * as XLSX from 'xlsx';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from './authorization';
import { auditLog } from './audit';
import { generateMatriculeEnseignant } from './matricule';
import { inviteUtilisateur } from './utilisateur';
import { createMatiere } from './matiere';
import {
  ENSEIGNANT_IMPORT_COLUMNS,
  enseignantImportLigneSchema,
  type EnseignantImportLigne,
  type LigneErreur,
} from '@/lib/import/enseignant-import-schema';

export interface LigneBrute {
  ligne: number; // numéro de ligne dans le fichier (1-based, hors en-tête)
  valeurs: Record<string, unknown>;
}

/**
 * Lit un classeur Excel (buffer) et retourne les lignes brutes de la première
 * feuille, alignées sur le gabarit de colonnes fixe. Ne valide rien ici.
 */
export function parseFichierExcel(buffer: ArrayBuffer | Buffer): LigneBrute[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false,
  });
  return rows.map((valeurs, index) => ({ ligne: index + 2, valeurs })); // +2: 1-based + en-tête
}

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

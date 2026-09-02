import { createClient } from '@/lib/supabase/server';
import { requireRole } from './authorization';
import { auditLog } from './audit';
import { createEleveAvecResponsables } from './eleve';
import { creerInscriptionAvecFacture } from './inscription';
import { lireClasseur, type LigneBrute } from '@/lib/import/excel';
import { analyserEntetes } from '@/lib/import/entetes';
import {
  cleIdentiteEleve,
  type AnalyseImport,
  type LigneAnalysee,
} from '@/lib/import/analyse';
import {
  ELEVE_IMPORT_COLUMNS,
  eleveImportLigneSchema,
  type EleveImportLigne,
  type LigneErreur,
} from '@/lib/import/eleve-import-schema';

export type { LigneBrute };

/**
 * Import des élèves, en deux temps : analyser, montrer, puis écrire.
 *
 * Le dépôt d'un fichier écrivait auparavant immédiatement. Deux défauts que
 * l'étape d'analyse ferme :
 *
 * - **On découvrait les refus après coup.** « 230 réussies, 3 échouées » est
 *   une information utile *avant* d'écrire, pas après.
 * - **Redéposer le fichier corrigé dupliquait tout le reste.** Rien dans la
 *   chaîne ne détectait un élève déjà présent : pas de recherche avant
 *   l'insertion, une unicité en base portant sur le seul matricule — lequel
 *   est un compteur `max+1`, donc structurellement incapable de rejouer la
 *   même valeur — et le garde-fou de `fn_inscrire_eleve` qui teste
 *   l'identifiant élève, neuf par construction. Le doublon n'était pas à
 *   moitié créé : il était créé, inscrit et **facturé**.
 *
 * `preparerImportEleves` est la **seule** source de vérité : l'écran de bilan
 * et l'écriture l'appellent tous deux, et l'écriture ne touche que les lignes
 * que l'analyse a marquées `PRETE`. Décider deux fois, à deux endroits,
 * finirait par afficher un bilan que l'écriture contredit.
 */

export interface ValidationResult {
  valides: { ligne: number; data: EleveImportLigne }[];
  erreurs: LigneErreur[];
}

export function validerLignes(lignes: LigneBrute[]): ValidationResult {
  const valides: ValidationResult['valides'] = [];
  const erreurs: LigneErreur[] = [];

  for (const { ligne, valeurs } of lignes) {
    const normalized: Record<string, unknown> = {};
    for (const col of ELEVE_IMPORT_COLUMNS) {
      const raw = valeurs[col];
      normalized[col] = typeof raw === 'string' ? raw.trim() : raw;
    }

    const parsed = eleveImportLigneSchema.safeParse(normalized);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        erreurs.push({ ligne, champ: String(issue.path[0] ?? '?'), message: issue.message });
      }
      continue;
    }
    valides.push({ ligne, data: parsed.data });
  }

  return { valides, erreurs };
}

/** Une ligne retenue pour l'écriture, avec sa classe déjà résolue. */
interface LigneAEcrire {
  ligne: number;
  data: EleveImportLigne;
  classeId: string;
}

export interface PreparationImportEleves {
  analyse: AnalyseImport;
  /** Non exposé au client : sert uniquement à l'écriture. */
  aEcrire: LigneAEcrire[];
}

function libelleLigne(data: EleveImportLigne): string {
  return `${data.nom} ${data.prenoms}`.trim();
}

/**
 * Analyse un fichier sans rien écrire : en-têtes, validation, classe
 * résolue, doublons.
 *
 * Le contrôle des en-têtes s'arrête net s'il échoue. Sans lui, un fichier dont
 * la colonne s'appelle « Date de naissance » produirait une erreur Zod sur
 * chacune de ses 230 lignes — 230 fois le même problème, situé en ligne 1.
 */
export async function preparerImportEleves(
  buffer: ArrayBuffer | Buffer,
  anneeScolaireId: string,
): Promise<PreparationImportEleves> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE');
  const supabase = createClient();

  const { entetes, lignes: lignesBrutes } = lireClasseur(buffer);
  const analyseEntetes = analyserEntetes(entetes, ELEVE_IMPORT_COLUMNS);

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
  const classeParNom = new Map((classes ?? []).map((c) => [c.nom.trim().toLowerCase(), c.id]));

  // Identités déjà en base. Une seule requête : le volume d'un établissement
  // se compte en milliers, et interroger ligne par ligne coûterait 230
  // allers-retours pour la même information.
  const { data: existants, error: existantsError } = await supabase
    .from('eleve')
    .select('nom, prenoms, "dateNaissance"')
    .eq('etablissementId', ctx.etablissementId);
  if (existantsError) throw existantsError;

  const identitesConnues = new Set(
    (existants ?? []).map((e) =>
      cleIdentiteEleve(
        e.nom as string,
        e.prenoms as string,
        String((e as { dateNaissance: string }).dateNaissance),
      ),
    ),
  );

  const lignesAnalysees: LigneAnalysee[] = [];
  const aEcrire: LigneAEcrire[] = [];

  // Les lignes rejetées par Zod comptent comme refusées, une seule fois chacune
  // même si plusieurs de leurs champs sont en cause.
  const lignesInvalides = new Map<number, string[]>();
  for (const e of erreurs) {
    const motifs = lignesInvalides.get(e.ligne) ?? [];
    motifs.push(`${e.champ} : ${e.message}`);
    lignesInvalides.set(e.ligne, motifs);
  }
  for (const [ligne, motifs] of lignesInvalides) {
    lignesAnalysees.push({
      ligne,
      statut: 'REFUSEE',
      libelle: `Ligne ${ligne}`,
      motif: motifs.join(' ; '),
    });
  }

  for (const { ligne, data } of valides) {
    const cle = cleIdentiteEleve(data.nom, data.prenoms, data.date_naissance);

    // L'ensemble grandit au fil du fichier. Sans cela, un classeur contenant
    // deux fois la même ligne verrait la seconde passer : la liste chargée
    // avant la boucle date d'avant la création de la première.
    if (identitesConnues.has(cle)) {
      lignesAnalysees.push({
        ligne,
        statut: 'DOUBLON',
        libelle: libelleLigne(data),
        motif: 'Élève déjà présent dans l’établissement',
      });
      continue;
    }

    const classeId = classeParNom.get(data.classe.trim().toLowerCase());
    if (!classeId) {
      lignesAnalysees.push({
        ligne,
        statut: 'REFUSEE',
        libelle: libelleLigne(data),
        motif: `Classe « ${data.classe} » introuvable pour l’année scolaire ciblée`,
      });
      continue;
    }

    identitesConnues.add(cle);
    lignesAnalysees.push({ ligne, statut: 'PRETE', libelle: libelleLigne(data), motif: '' });
    aEcrire.push({ ligne, data, classeId });
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

export interface ImportRapportLigne {
  ligne: number;
  ok: boolean;
  message: string;
  eleveId?: string;
}

export interface ImportRapport {
  totalLignes: number;
  succes: number;
  /** Refus survenus à l'écriture, après une analyse pourtant favorable. */
  echecs: number;
  /** Lignes écartées à l'analyse parce que déjà présentes. Pas des échecs. */
  doublons: number;
  details: ImportRapportLigne[];
}

/**
 * Écrit les lignes que l'analyse a retenues.
 *
 * Le fichier est **relu et réanalysé** ici plutôt que de transporter l'analyse
 * depuis l'écran : une analyse envoyée au navigateur puis renvoyée est une
 * décision que l'appelant peut réécrire. Relire coûte une lecture de classeur
 * et garantit que ce qu'on écrit a été décidé côté serveur.
 *
 * Traitement ligne par ligne : une ligne en échec n'arrête pas les suivantes.
 * Un seul `auditLog` récapitulatif, comme avant.
 */
export async function executerImportEleves(
  buffer: ArrayBuffer | Buffer,
  anneeScolaireId: string,
): Promise<{ analyse: AnalyseImport; rapport: ImportRapport }> {
  const { analyse, aEcrire } = await preparerImportEleves(buffer, anneeScolaireId);

  const details: ImportRapportLigne[] = [];

  for (const { ligne, data, classeId } of aEcrire) {
    try {
      const eleveId = await createEleveAvecResponsables({
        nom: data.nom,
        prenoms: data.prenoms,
        sexe: data.sexe,
        dateNaissance: data.date_naissance,
        lieuNaissance: data.lieu_naissance || undefined,
        nationalite: data.nationalite || undefined,
        ancienMatricule: data.ancien_matricule || undefined,
        anneeScolaireIdPourMatricule: anneeScolaireId,
        responsables: [
          {
            nom: data.nom_responsable,
            prenoms: data.prenoms_responsable,
            telephone: data.telephone_responsable || undefined,
            email: data.email_responsable || undefined,
            type: data.type_responsable,
            lienParente: data.lien_parente,
            principal: data.principal,
          },
        ],
      });

      await creerInscriptionAvecFacture({ eleveId, anneeScolaireId, classeId });

      details.push({ ligne, ok: true, message: 'Importé avec succès', eleveId });
    } catch (e) {
      details.push({
        ligne,
        ok: false,
        message: e instanceof Error ? e.message : "Erreur inconnue lors de l'import",
      });
    }
  }

  const succes = details.filter((d) => d.ok).length;
  const echecs = details.length - succes;
  const doublons = analyse.lignes.filter((l) => l.statut === 'DOUBLON').length;

  await auditLog({
    action: 'IMPORT_ELEVES',
    module: 'eleves',
    objetType: 'ImportEleves',
    nouvelleValeur: { anneeScolaireId, totalLignes: details.length, succes, echecs, doublons },
  });

  return {
    analyse,
    rapport: { totalLignes: details.length, succes, echecs, doublons, details },
  };
}

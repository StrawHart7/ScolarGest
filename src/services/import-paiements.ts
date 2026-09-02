import { createClient } from '@/lib/supabase/server';
import { requireRole } from './authorization';
import { auditLog } from './audit';
import { enregistrerPaiement } from './paiement';
import { lireClasseur, type LigneBrute } from '@/lib/import/excel';
import { analyserEntetes } from '@/lib/import/entetes';
import type { AnalyseImport, LigneAnalysee } from '@/lib/import/analyse';
import {
  PAIEMENT_IMPORT_COLUMNS,
  paiementImportLigneSchema,
  type PaiementImportLigne,
} from '@/lib/import/paiement-import-schema';
import type { LigneErreur } from '@/lib/import/eleve-import-schema';

export type { LigneBrute };

export interface ValidationResult {
  valides: { ligne: number; data: PaiementImportLigne }[];
  erreurs: LigneErreur[];
}

export function validerLignes(lignes: LigneBrute[]): ValidationResult {
  const valides: ValidationResult['valides'] = [];
  const erreurs: LigneErreur[] = [];

  for (const { ligne, valeurs } of lignes) {
    const normalized: Record<string, unknown> = {};
    for (const col of PAIEMENT_IMPORT_COLUMNS) {
      const raw = valeurs[col];
      normalized[col] = typeof raw === 'string' ? raw.trim() : raw;
    }

    const parsed = paiementImportLigneSchema.safeParse(normalized);
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

export interface ImportRapportLigne {
  ligne: number;
  ok: boolean;
  message: string;
  eleveId?: string;
}

export interface ImportRapport {
  totalLignes: number;
  succes: number;
  echecs: number;
  details: ImportRapportLigne[];
  erreursValidation: LigneErreur[];
}

/**
 * Importe des versements historiques déjà validés. Chaque ligne passe par
 * `enregistrerPaiement`, donc par la RPC transactionnelle : les mêmes règles
 * s'appliquent qu'à une saisie manuelle (montant positif, pas de dépassement
 * du solde, statut de facture recalculé, audit). Un import ne doit pas être
 * une porte dérobée qui contourne les contrôles métier.
 *
 * Traitement ligne par ligne : une ligne en échec n'empêche pas les
 * suivantes, et le rapport dit précisément laquelle a échoué et pourquoi.
 */
export async function importerLignesValides(
  lignesValides: { ligne: number; data: PaiementImportLigne }[],
  anneeScolaireId: string,
): Promise<ImportRapport> {
  const ctx = await requireRole('COMPTABLE', 'SECRETAIRE');
  const supabase = createClient();

  const matricules = [...new Set(lignesValides.map((l) => l.data.matricule.trim()))];

  const { data: eleves, error: elevesError } = await supabase
    .from('eleve')
    .select('id, matricule')
    .eq('etablissementId', ctx.etablissementId)
    .in('matricule', matricules);
  if (elevesError) throw elevesError;
  const eleveParMatricule = new Map(
    (eleves ?? []).map((e: { id: string; matricule: string }) => [e.matricule, e.id]),
  );

  const { data: factures, error: facturesError } = await supabase
    .from('facture_eleve')
    .select('id, "eleveId", statut')
    .eq('etablissementId', ctx.etablissementId)
    .eq('anneeScolaireId', anneeScolaireId);
  if (facturesError) throw facturesError;
  const factureParEleve = new Map(
    (factures ?? []).map((f: { id: string; eleveId: string; statut: string }) => [
      f.eleveId,
      { id: f.id, statut: f.statut },
    ]),
  );

  const details: ImportRapportLigne[] = [];

  for (const { ligne, data } of lignesValides) {
    const matricule = data.matricule.trim();
    const eleveId = eleveParMatricule.get(matricule);
    if (!eleveId) {
      details.push({ ligne, ok: false, message: `Aucun élève avec le matricule "${matricule}"` });
      continue;
    }

    const facture = factureParEleve.get(eleveId);
    if (!facture) {
      details.push({
        ligne,
        ok: false,
        message: `Aucune facture pour cet élève sur l'année scolaire ciblée (élève non inscrit ?)`,
        eleveId,
      });
      continue;
    }
    if (facture.statut === 'ANNULE') {
      details.push({ ligne, ok: false, message: 'La facture de cet élève est annulée', eleveId });
      continue;
    }

    try {
      await enregistrerPaiement({
        factureId: facture.id,
        montant: data.montant,
        modePaiement: data.mode_paiement,
        reference: data.reference || null,
        datePaiement: `${data.date_paiement}T12:00:00Z`,
      });
      details.push({ ligne, ok: true, message: 'Versement importé', eleveId });
    } catch (e) {
      details.push({
        ligne,
        ok: false,
        message: e instanceof Error ? e.message : "Erreur inconnue lors de l'import",
        eleveId,
      });
    }
  }

  const succes = details.filter((d) => d.ok).length;
  const echecs = details.length - succes;

  await auditLog({
    action: 'IMPORT_PAIEMENTS',
    module: 'finance',
    objetType: 'ImportPaiements',
    nouvelleValeur: { anneeScolaireId, totalLignes: details.length, succes, echecs },
  });

  return { totalLignes: details.length, succes, echecs, details, erreursValidation: [] };
}

/**
 * Analyse un fichier de versements sans rien ecrire.
 *
 * Toutes les resolutions sont ici des lectures — eleve par matricule, facture
 * de l'annee, statut — donc l'analyse dit exactement ce que fera l'ecriture.
 *
 * **Pas de detection de doublons.** Un versement identique un meme jour est un
 * cas legitime : deux tranches reglees le matin et l'apres-midi. Le refuser au
 * motif qu'il ressemble au precedent ferait disparaitre de l'argent
 * reellement encaisse. C'est l'inverse du raisonnement retenu pour les eleves,
 * ou le doublon n'a jamais de sens.
 *
 * Ce que l'analyse ne peut pas anticiper : le depassement du solde. Il depend
 * du cumul des lignes du fichier, que seule l'ecriture connait ligne apres
 * ligne — `enregistrerPaiement` le refusera alors, et le rapport final le dira.
 */
export async function preparerImportPaiements(
  buffer: ArrayBuffer | Buffer,
  anneeScolaireId: string,
): Promise<{
  analyse: AnalyseImport;
  aEcrire: { ligne: number; data: PaiementImportLigne }[];
}> {
  const ctx = await requireRole('COMPTABLE', 'SECRETAIRE');
  const supabase = createClient();

  const { entetes, lignes: lignesBrutes } = lireClasseur(buffer);
  const analyseEntetes = analyserEntetes(entetes, PAIEMENT_IMPORT_COLUMNS);
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

  const matricules = [...new Set(valides.map((l) => l.data.matricule.trim()))];
  const eleveParMatricule = new Map<string, string>();
  if (matricules.length > 0) {
    const { data: eleves, error } = await supabase
      .from('eleve')
      .select('id, matricule')
      .eq('etablissementId', ctx.etablissementId)
      .in('matricule', matricules);
    if (error) throw error;
    for (const e of (eleves ?? []) as { id: string; matricule: string }[]) {
      eleveParMatricule.set(e.matricule, e.id);
    }
  }

  const { data: factures, error: facturesError } = await supabase
    .from('facture_eleve')
    .select('id, "eleveId", statut')
    .eq('etablissementId', ctx.etablissementId)
    .eq('anneeScolaireId', anneeScolaireId);
  if (facturesError) throw facturesError;
  const factureParEleve = new Map(
    ((factures ?? []) as { id: string; eleveId: string; statut: string }[]).map((f) => [
      f.eleveId,
      f.statut,
    ]),
  );

  const lignesAnalysees: LigneAnalysee[] = [];
  const aEcrire: { ligne: number; data: PaiementImportLigne }[] = [];

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
    const matricule = data.matricule.trim();
    const libelle = `${matricule} — ${data.montant}`;

    const eleveId = eleveParMatricule.get(matricule);
    if (!eleveId) {
      lignesAnalysees.push({
        ligne,
        statut: 'REFUSEE',
        libelle,
        motif: `Aucun élève avec le matricule « ${matricule} »`,
      });
      continue;
    }

    const statutFacture = factureParEleve.get(eleveId);
    if (!statutFacture) {
      lignesAnalysees.push({
        ligne,
        statut: 'REFUSEE',
        libelle,
        motif: 'Aucune facture sur l’année scolaire ciblée (élève non inscrit ?)',
      });
      continue;
    }
    if (statutFacture === 'ANNULE') {
      lignesAnalysees.push({
        ligne,
        statut: 'REFUSEE',
        libelle,
        motif: 'La facture de cet élève est annulée',
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

/** Ecrit les versements retenus par l'analyse. Le fichier est relu cote serveur. */
export async function executerImportPaiements(
  buffer: ArrayBuffer | Buffer,
  anneeScolaireId: string,
): Promise<{ analyse: AnalyseImport; rapport: ImportRapport }> {
  const { analyse, aEcrire } = await preparerImportPaiements(buffer, anneeScolaireId);
  if (aEcrire.length === 0) {
    return {
      analyse,
      rapport: { totalLignes: 0, succes: 0, echecs: 0, details: [], erreursValidation: [] },
    };
  }
  const rapport = await importerLignesValides(aEcrire, anneeScolaireId);
  return { analyse, rapport };
}

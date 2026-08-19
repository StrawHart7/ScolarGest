import * as XLSX from 'xlsx';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from './authorization';
import { auditLog } from './audit';
import { enregistrerPaiement } from './paiement';
import {
  PAIEMENT_IMPORT_COLUMNS,
  paiementImportLigneSchema,
  type PaiementImportLigne,
} from '@/lib/import/paiement-import-schema';
import type { LigneErreur } from '@/lib/import/eleve-import-schema';

export interface LigneBrute {
  ligne: number; // numéro de ligne dans le fichier (1-based, hors en-tête)
  valeurs: Record<string, unknown>;
}

/** Lit la première feuille d'un classeur Excel. Ne valide rien ici. */
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
  const ctx = await requireRole('COMPTABLE');
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

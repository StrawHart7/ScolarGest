import * as XLSX from 'xlsx';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from './authorization';
import { auditLog } from './audit';
import { createEleveAvecResponsables } from './eleve';
import { creerInscriptionAvecFacture } from './inscription';
import {
  ELEVE_IMPORT_COLUMNS,
  eleveImportLigneSchema,
  type EleveImportLigne,
  type LigneErreur,
} from '@/lib/import/eleve-import-schema';

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
 * Importe les lignes déjà validées : résout classeId par nom (dans l'année
 * scolaire cible), crée élève+responsable via RPC puis l'inscription+facture
 * via RPC. Traitement ligne par ligne : une ligne en échec n'empêche pas les
 * suivantes. Un seul auditLog récapitulatif est posé à la fin.
 */
export async function importerLignesValides(
  lignesValides: { ligne: number; data: EleveImportLigne }[],
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

  const details: ImportRapportLigne[] = [];

  for (const { ligne, data } of lignesValides) {
    try {
      const classeId = classeParNom.get(data.classe.trim().toLowerCase());
      if (!classeId) {
        details.push({
          ligne,
          ok: false,
          message: `Classe "${data.classe}" introuvable pour l'année scolaire ciblée`,
        });
        continue;
      }

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
            principal: data.principal ?? true,
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

  await auditLog({
    action: 'IMPORT_ELEVES',
    module: 'eleves',
    objetType: 'ImportEleves',
    nouvelleValeur: { anneeScolaireId, totalLignes: details.length, succes, echecs },
  });

  return { totalLignes: details.length, succes, echecs, details, erreursValidation: [] };
}

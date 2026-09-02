import * as XLSX from 'xlsx';

/**
 * Lecture d'un classeur Excel, partagée par les trois imports.
 *
 * Les trois services en portaient chacun une copie identique de `parseFichierExcel`,
 * ce qui garantissait qu'une correction n'en toucherait qu'un sur trois.
 *
 * **Serveur uniquement** : ce module importe `xlsx`. Ne jamais l'importer
 * depuis un composant client — le contrôle des en-têtes, lui, vit dans
 * `entetes.ts`, qui ne dépend de rien.
 */

export interface LigneBrute {
  /** Numéro de ligne dans le fichier (1-based, en-tête comprise). */
  ligne: number;
  valeurs: Record<string, unknown>;
}

export interface ClasseurLu {
  /** En-têtes de la première ligne, dans l'ordre du fichier. */
  entetes: string[];
  lignes: LigneBrute[];
}

/**
 * Lit la première feuille : en-têtes bruts et lignes de données.
 *
 * Les clés des lignes sont **normalisées en minuscules** et débarrassées de
 * leurs espaces de bord, comme `normaliserEntete`. Sans cela un fichier dont
 * l'en-tête dit « Nom » passerait le contrôle d'en-têtes — qui compare en
 * minuscules — puis produirait un « Nom requis » sur chacune de ses lignes,
 * parce que la lecture, elle, cherchait la clé exacte. Les deux étapes doivent
 * s'accorder sur ce qu'est une colonne.
 */
export function lireClasseur(buffer: ArrayBuffer | Buffer): ClasseurLu {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { entetes: [], lignes: [] };
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return { entetes: [], lignes: [] };

  const matrice = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  });
  const entetes = (matrice[0] ?? []).map((v) => String(v ?? ''));

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false,
  });

  const lignes = rows.map((valeurs, index) => {
    const normalisees: Record<string, unknown> = {};
    for (const [cle, valeur] of Object.entries(valeurs)) {
      normalisees[cle.trim().toLowerCase()] = valeur;
    }
    return { ligne: index + 2, valeurs: normalisees }; // +2 : 1-based + en-tête
  });

  return { entetes, lignes };
}

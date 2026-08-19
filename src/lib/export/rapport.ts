import * as XLSX from 'xlsx';

/**
 * Forme commune à tous les rapports : une même structure alimente l'aperçu à
 * l'écran, l'export Excel, le CSV et le PDF. Un rapport se définit une fois
 * dans `src/services/rapport.ts` et devient exportable dans les trois formats
 * sans code supplémentaire.
 */
export interface ColonneRapport {
  cle: string;
  libelle: string;
  /** Aligne à droite et formate en séparateurs de milliers. */
  numerique?: boolean;
}

export type ValeurCellule = string | number | null;

export interface Rapport {
  titre: string;
  sousTitre?: string;
  colonnes: ColonneRapport[];
  lignes: Record<string, ValeurCellule>[];
  /** Ligne de totaux affichée en pied de tableau, si le rapport en a une. */
  totaux?: Record<string, ValeurCellule>;
}

export type FormatExport = 'xlsx' | 'csv' | 'pdf';

/** Rendu d'une cellule pour l'affichage et les exports texte. */
export function formaterCellule(valeur: ValeurCellule, numerique = false): string {
  if (valeur === null || valeur === undefined) return '';
  if (numerique && typeof valeur === 'number') return valeur.toLocaleString('fr-FR');
  return String(valeur);
}

/** Matrice titre-exclu : en-têtes puis lignes, telle qu'attendue par Excel. */
export function versMatrice(rapport: Rapport): ValeurCellule[][] {
  const entetes = rapport.colonnes.map((c) => c.libelle);
  const lignes = rapport.lignes.map((ligne) => rapport.colonnes.map((c) => ligne[c.cle] ?? null));
  if (rapport.totaux) {
    lignes.push(rapport.colonnes.map((c) => rapport.totaux![c.cle] ?? null));
  }
  return [entetes, ...lignes];
}

/**
 * CSV séparé par des points-virgules et encodé avec un BOM UTF-8 : c'est ce
 * qu'attend Excel en configuration française, sinon les accents sont cassés
 * et toutes les colonnes atterrissent dans la première.
 */
export function versCsv(rapport: Rapport): string {
  const echapper = (valeur: ValeurCellule): string => {
    const texte = valeur === null || valeur === undefined ? '' : String(valeur);
    return /[";\r\n]/.test(texte) ? `"${texte.replace(/"/g, '""')}"` : texte;
  };

  const lignes = versMatrice(rapport).map((ligne) => ligne.map(echapper).join(';'));
  return `﻿${lignes.join('\r\n')}\r\n`;
}

/** Classeur Excel d'une seule feuille, nommée d'après le rapport. */
export function versXlsx(rapport: Rapport): Buffer {
  const feuille = XLSX.utils.aoa_to_sheet(versMatrice(rapport));
  feuille['!cols'] = rapport.colonnes.map((c) => ({ wch: Math.max(c.libelle.length + 2, 14) }));
  const classeur = XLSX.utils.book_new();
  // Excel refuse les noms de feuille de plus de 31 caractères.
  XLSX.utils.book_append_sheet(classeur, feuille, rapport.titre.slice(0, 31));
  return XLSX.write(classeur, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

function echapperHtml(texte: string): string {
  return texte
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Page HTML A4 paysage prête pour `renderHtmlToPdf`. Le paysage est le bon
 * défaut ici : un rapport a plus de colonnes qu'un bulletin.
 */
export function versHtml(
  rapport: Rapport,
  contexte: { etablissement: string; genereLe: string },
): string {
  const entetes = rapport.colonnes
    .map(
      (c) =>
        `<th class="${c.numerique ? 'num' : ''}">${echapperHtml(c.libelle)}</th>`,
    )
    .join('');

  const corps = rapport.lignes
    .map(
      (ligne) =>
        `<tr>${rapport.colonnes
          .map(
            (c) =>
              `<td class="${c.numerique ? 'num' : ''}">${echapperHtml(formaterCellule(ligne[c.cle] ?? null, c.numerique))}</td>`,
          )
          .join('')}</tr>`,
    )
    .join('');

  const pied = rapport.totaux
    ? `<tr class="totaux">${rapport.colonnes
        .map(
          (c) =>
            `<td class="${c.numerique ? 'num' : ''}">${echapperHtml(formaterCellule(rapport.totaux![c.cle] ?? null, c.numerique))}</td>`,
        )
        .join('')}</tr>`
    : '';

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>${echapperHtml(rapport.titre)}</title>
<style>
  @page { size: A4 landscape; margin: 14mm; }
  body { font-family: "Helvetica Neue", Arial, sans-serif; color: #1a1c22; font-size: 10pt; }
  header { border-bottom: 2px solid #1a3a6b; padding-bottom: 8px; margin-bottom: 14px; }
  h1 { font-size: 15pt; margin: 0 0 2px; color: #1a3a6b; }
  .meta { font-size: 9pt; color: #5a6070; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border-bottom: 1px solid #e2e5ec; padding: 5px 6px; text-align: left; }
  th { background: #f4f6fa; font-size: 9pt; text-transform: uppercase; letter-spacing: .04em; color: #5a6070; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  tr.totaux td { font-weight: 700; border-top: 2px solid #1a3a6b; border-bottom: none; }
  footer { margin-top: 16px; font-size: 8pt; color: #8a90a0; }
</style>
</head>
<body>
  <header>
    <h1>${echapperHtml(rapport.titre)}</h1>
    <div class="meta">${echapperHtml(contexte.etablissement)}${rapport.sousTitre ? ` — ${echapperHtml(rapport.sousTitre)}` : ''}</div>
  </header>
  <table>
    <thead><tr>${entetes}</tr></thead>
    <tbody>${corps}${pied}</tbody>
  </table>
  <footer>Généré le ${echapperHtml(contexte.genereLe)} — ${rapport.lignes.length} ligne(s)</footer>
</body>
</html>`;
}

/** Nom de fichier sûr : sans accent, sans espace, daté. */
export function nomFichier(rapport: Rapport, format: FormatExport, date = new Date()): string {
  const base = rapport.titre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return `${base}-${date.toISOString().slice(0, 10)}.${format}`;
}

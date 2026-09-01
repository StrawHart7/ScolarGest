import { JOURS, RANGS, type Creneau } from '@/lib/emploi-du-temps';
import {
  STYLE_IDENTITE,
  htmlFiligrane,
  htmlLogo,
  type IdentiteDocument,
} from './identite';

/**
 * Emploi du temps hebdomadaire, en PDF.
 *
 * **Paysage.** Six jours en colonnes ne tiennent pas lisiblement sur la largeur
 * d'un A4 portrait : les noms de matières y seraient coupés ou réduits à une
 * taille qu'on n'affiche pas au mur d'une salle de classe. L'orientation est
 * imposée par `@page { size: A4 landscape }` plutôt que par une option de
 * rendu, pour que le gabarit reste autonome — `renderHtmlToPdf` est partagé
 * avec les bulletins et les reçus, qui eux sont en portrait.
 *
 * La grille est dessinée en entier, cases vides comprises. Un emploi du temps
 * imprimé sert aussi à voir les trous ; n'imprimer que les cases remplies
 * produirait un tableau ajouré illisible.
 */

export interface DonneesEmploiDuTemps {
  etablissement: string;
  classe: string;
  niveau: string;
  anneeScolaire: string;
  creneaux: Creneau[];
  identite?: IdentiteDocument;
}

function esc(v: string): string {
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Index `jour:rang` → créneau, pour un accès direct au moment du dessin. */
function indexer(creneaux: Creneau[]): Map<string, Creneau> {
  const index = new Map<string, Creneau>();
  for (const c of creneaux) index.set(`${c.jour}:${c.rang}`, c);
  return index;
}

function cellule(creneau: Creneau | undefined): string {
  if (!creneau) return '<td class="vide"></td>';
  const enseignant = creneau.enseignant
    ? `<div class="ens">${esc(creneau.enseignant.nom)} ${esc(creneau.enseignant.prenoms)}</div>`
    : '';
  const salle = creneau.salle ? `<div class="salle">${esc(creneau.salle)}</div>` : '';
  return `<td class="occupee"><div class="mat">${esc(creneau.matiere.nom)}</div>${enseignant}${salle}</td>`;
}

export function emploiDuTempsHtml(donnees: DonneesEmploiDuTemps): string {
  const index = indexer(donnees.creneaux);

  const entetes = JOURS.map((j) => `<th class="jour">${esc(j)}</th>`).join('');

  const lignes = RANGS.map((libelle, i) => {
    const rang = i + 1;
    const cases = JOURS.map((_, j) => cellule(index.get(`${j + 1}:${rang}`))).join('');
    return `<tr><th class="rang">${esc(libelle)}</th>${cases}</tr>`;
  }).join('');

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>Emploi du temps — ${esc(donnees.classe)}</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  * { box-sizing: border-box; }
  body {
    font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
    color: #1a1a1a;
    margin: 0;
    font-size: 10pt;
  }
  header { text-align: center; margin-bottom: 12px; }
  .etab { font-size: 13pt; font-weight: bold; color: #1b3a6b; }
  .titre { font-size: 15pt; font-weight: bold; margin-top: 4px; }
  .meta { font-size: 9pt; color: #555; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  th, td {
    border: 1px solid #c3ccd8;
    padding: 5px 4px;
    text-align: center;
    vertical-align: middle;
    height: 58px;
  }
  th.jour {
    background: #1b3a6b;
    color: #fff;
    font-size: 10pt;
    height: 26px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  th.rang {
    background: #eef2f7;
    font-size: 8.5pt;
    font-weight: 600;
    width: 13%;
    text-align: left;
    padding-left: 8px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  td.vide { background: #fbfcfd; }
  .mat { font-weight: bold; font-size: 9.5pt; line-height: 1.2; }
  .ens { font-size: 8pt; color: #444; margin-top: 2px; }
  .salle { font-size: 7.5pt; color: #777; margin-top: 1px; }
  footer { margin-top: 10px; font-size: 8pt; color: #777; text-align: right; }
${STYLE_IDENTITE}
</style>
</head>
<body>
${htmlFiligrane(donnees.identite)}
<header>
  ${htmlLogo(donnees.identite)}
  <div class="etab">${esc(donnees.etablissement)}</div>
  <div class="titre">Emploi du temps — ${esc(donnees.classe)}</div>
  <div class="meta">${esc(donnees.niveau)} · Année scolaire ${esc(donnees.anneeScolaire)}</div>
</header>
<table>
  <thead><tr><th class="rang"></th>${entetes}</tr></thead>
  <tbody>${lignes}</tbody>
</table>
<footer>Édité le ${new Date().toLocaleDateString('fr-FR')}</footer>
</body>
</html>`;
}

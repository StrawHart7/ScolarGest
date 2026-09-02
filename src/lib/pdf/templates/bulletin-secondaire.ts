import type { BulletinTemplateInput } from './bulletin';
import { STYLE_IDENTITE, htmlFiligrane, htmlLogo } from './identite';

/**
 * Bulletin officiel Collège / Lycée — République Togolaise, Ministère des
 * Enseignements Primaire et Secondaire.
 *
 * Fac-similé du modèle fourni par l'établissement : en-tête à trois colonnes,
 * encart Sexe/Statut, tableau des matières à dix colonnes, puis le bloc de
 * bas de page (assiduité, distinctions, résultats, décision du conseil,
 * observation du chef d'établissement).
 *
 * Les zones en pointillés du modèle papier (absences, retards, punitions,
 * exclusions, tableau d'honneur, félicitations, décision du conseil,
 * observation du chef d'établissement) **n'existent pas en base** : elles sont
 * rendues vides, exactement comme sur l'original, pour être remplies à la main
 * après impression. Les remplir avec des valeurs inventées serait pire que de
 * les laisser vides.
 *
 * Les autres cycles conservent le gabarit `bulletin.ts`.
 */

function esc(v: string | null | undefined): string {
  if (v === null || v === undefined) return '';
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Le modèle affiche les notes sans décimale superflue (16 et non 16.00). */
function num(v: number | null): string {
  if (v === null) return '';
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0$/, '');
}

/** Appréciation littérale, dérivée de la moyenne de la matière. */
function appreciationMatiere(moyenne: number | null): string {
  if (moyenne === null) return '';
  if (moyenne >= 18) return 'Excellent';
  if (moyenne >= 16) return 'Très Bien';
  if (moyenne >= 14) return 'Bien';
  if (moyenne >= 12) return 'Assez Bien';
  if (moyenne >= 10) return 'Passable';
  if (moyenne >= 8) return 'Insuffisant';
  return 'Très Insuffisant';
}

/**
 * Note définitive = moyenne de la matière × coefficient.
 *
 * C'est le total de points que la matière apporte, celui qui alimente la somme
 * du pied de tableau. La colonne reprenait jusqu'ici `moyenneFinale`, donc la
 * même valeur que « Moy. Géné sur 20 » deux colonnes plus tôt — le coefficient
 * n'était jamais appliqué.
 */
function noteDefinitive(moyenne: number | null, coefficient: number): number | null {
  if (moyenne === null) return null;
  return moyenne * coefficient;
}

/**
 * Hauteur de ligne du tableau des matières, calculée à la génération.
 *
 * **Toutes les lignes d'un bulletin ont la même hauteur, et deux élèves d'une
 * même classe reçoivent un document au même gabarit.** Auparavant la hauteur
 * d'une ligne suivait son contenu : un nom de professeur long ou une
 * appréciation en deux mots faisait grossir la ligne. Sur une pile de
 * bulletins signés à la main, l'irrégularité se voit immédiatement.
 *
 * Le budget est le corps de page A4 (297 mm − 24 mm de marges ≈ 1032 px à
 * 96 dpi) moins l'en-tête du document, l'en-tête du tableau, la ligne TOTAL et
 * le bloc de pied. Il est réparti à parts égales entre les matières, borné pour
 * rester lisible : une classe à six matières n'étire pas ses lignes jusqu'à
 * l'absurde, une classe à quinze ne déborde pas sur une seconde page.
 *
 * Le reliquat n'est pas comblé par des lignes anonymes — elles ont été
 * supprimées à dessein le 2026-08-30 — mais absorbé par le `margin-top:auto` du
 * bloc de pied, qui reste ainsi collé au bas de la page.
 */
const BUDGET_CORPS_PX = 452;
const HAUTEUR_LIGNE_MIN_PX = 20;
const HAUTEUR_LIGNE_MAX_PX = 38;

export function hauteurLigneMatiere(nombreMatieres: number): number {
  if (nombreMatieres <= 0) return HAUTEUR_LIGNE_MIN_PX;
  const brute = Math.floor(BUDGET_CORPS_PX / nombreMatieres);
  return Math.max(HAUTEUR_LIGNE_MIN_PX, Math.min(HAUTEUR_LIGNE_MAX_PX, brute));
}

export function renderBulletinSecondaireHtml(
  input: BulletinTemplateInput & { eleve: { sexe?: 'M' | 'F' } },
): string {
  const { etablissement, eleve, donnees, classeNom, anneeScolaireLibelle, periodeLabel, identite } =
    input;
  const synthese = donnees.synthese;

  const periodeMajuscule = periodeLabel.toUpperCase();
  const sexeLibelle = eleve.sexe === 'F' ? 'Féminin' : eleve.sexe === 'M' ? 'Masculin' : '';

  const hauteurLigne = hauteurLigneMatiere(donnees.matieres.length);
  // La hauteur utile retranche bordures et padding vertical : c'est elle qui
  // plafonne le contenu, sans quoi un texte long repousserait la ligne et
  // ruinerait l'égalité des hauteurs.
  const hauteurUtile = hauteurLigne - 6;

  const lignesRemplies = donnees.matieres
    .map(
      (m) => `
      <tr>
        <td class="c-matiere"><div class="cellule">${esc(m.matiereNom)}</div></td>
        <td class="num"><div class="cellule">${num(m.moyClasse)}</div></td>
        <td class="num"><div class="cellule">${num(m.composition)}</div></td>
        <td class="num"><div class="cellule">${num(m.moyenneFinale)}</div></td>
        <td class="num"><div class="cellule">${m.coefficient || ''}</div></td>
        <td class="num"><div class="cellule">${num(noteDefinitive(m.moyenneFinale, m.coefficient))}</div></td>
        <td class="num"><div class="cellule">${m.rangMatiere ?? ''}</div></td>
        <td><div class="cellule">${esc(appreciationMatiere(m.moyenneFinale))}</div></td>
        <td><div class="cellule">${esc(m.professeurs)}</div></td>
        <td></td>
      </tr>`,
    )
    .join('');

  // Plus de lignes de remplissage anonymes : le tableau était complété
  // jusqu'à vingt lignes vides et sans intitulé. Le bulletin liste désormais
  // exactement les matières du programme du niveau — une matière sans note
  // apparaît avec son nom et des cellules vides, comme sur le modèle papier
  // (Allemand, Ewe, Musique… y figurent sans notes).

  const totalCoefficients = donnees.matieres.reduce((s, m) => s + (m.coefficient || 0), 0);
  const totalPoints = donnees.matieres.reduce(
    (s, m) => s + (m.moyenneFinale === null ? 0 : m.moyenneFinale * (m.coefficient || 0)),
    0,
  );

  /** Une ligne « libellé … valeur » du bloc des résultats. */
  const ligneResultat = (libelle: string, valeur: string, classe = '') =>
    `<tr class="${classe}"><th>${libelle}</th><td>${valeur}</td></tr>`;

  const sur20 = (v: number | null) => (v === null ? '—' : `${num(v)} / 20`);

  // Un seul bloc de moyennes, et chaque chiffre n'y figure qu'une fois. Le pied
  // affichait la moyenne de la période deux fois sous deux noms différents
  // (« Moyenne du 1ER TRIMESTRE » puis « Moyenne du Semestre »), dans deux
  // cellules distinctes : le lecteur devait vérifier lui-même qu'il s'agissait
  // du même nombre.
  //
  // Il n'existe pas de classement annuel en base. Afficher « Rang sur 20
  // élèves » sans rang, comme le faisait la version précédente, laissait croire
  // à une donnée manquante plutôt qu'à une donnée qui n'existe pas.
  const lignesResultats = [
    ligneResultat(`Moyenne du ${esc(periodeLabel)}`, sur20(synthese.moyenneTrimestrielle), 'forte'),
    ligneResultat(
      'Rang',
      `${synthese.rangGeneral ?? '—'}<span class="menu"> sur ${synthese.effectifClasse} élèves</span>`,
    ),
    synthese.appreciation ? ligneResultat('Appréciation', esc(synthese.appreciation)) : '',
    ligneResultat(
      'Moyenne générale de la classe',
      sur20(synthese.moyenneGeneraleClasse),
      'separateur',
    ),
    ligneResultat('Moyenne la plus forte', sur20(synthese.meilleureMoyenneClasse)),
    ligneResultat('Moyenne la plus faible', sur20(synthese.plusFaibleMoyenneClasse)),
    synthese.moyenneAnnuelle !== null
      ? ligneResultat('Moyenne annuelle', sur20(synthese.moyenneAnnuelle), 'separateur forte')
      : '',
  ].join('');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>Bulletin ${esc(eleve.nom)} ${esc(eleve.prenoms)}</title>
<style>
  @page { size: A4 portrait; margin: 12mm 10mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "Times New Roman", Times, serif;
    font-size: 10.5px;
    color: #000;
    line-height: 1.25;
    /* Le document occupe exactement une page : le bloc de pied est poussé au
       bas par son margin-top:auto, quel que soit le nombre de matières. */
    min-height: 273mm;
    display: flex;
    flex-direction: column;
  }
  .entete { display: flex; justify-content: space-between; align-items: flex-start; }
  .entete .colonne { width: 33%; }
  .entete .centre { text-align: center; }
  .entete .droite { text-align: left; }
  .ministere { text-align: center; font-weight: bold; text-transform: uppercase; }
  .ministere .souligne { display: inline-block; border-bottom: 1px solid #000; padding: 0 2px; }
  .republique { text-align: right; font-weight: bold; }
  .devise { text-align: right; font-style: italic; font-weight: normal; }
  .trait-court { width: 70px; border-top: 1px solid #000; margin: 10px auto 10px 34px; }
  .titre-bulletin { text-align: center; font-weight: bold; margin: 12px 0 8px; font-size: 12px; }
  .bloc-sexe { border: 1px solid #000; width: 210px; margin-left: auto; }
  .bloc-sexe table { width: 100%; border-collapse: collapse; }
  .bloc-sexe td, .bloc-sexe th {
    border: 1px solid #000; padding: 2px 4px; font-weight: normal; text-align: left;
  }
  .bloc-sexe .valeur { text-align: center; height: 18px; }
  .nom-eleve { text-align: center; margin: 10px 0 6px; }

  /* flex:1 fait occuper au tableau toute la hauteur laissée libre par
     l'en-tête et le pied : le surplus est réparti entre des lignes de hauteur
     identique, donc également, et la page est pleine sans ligne inventée. */
  table.notes {
    width: 100%; border-collapse: collapse; table-layout: fixed; flex: 1 1 auto;
  }
  table.notes th, table.notes td { border: 1px solid #000; padding: 2px 3px; }
  /* Les lignes pouvant être hautes, le contenu est centré verticalement :
     collé en haut d'une case de 90 px, il flotterait. */
  table.notes tbody td { vertical-align: middle; }
  table.notes tbody tr { height: ${hauteurLigne}px; }
  /* Le contenu est plafonné au lieu de pousser la ligne : deux bulletins de la
     même classe gardent le même gabarit. */
  table.notes tbody td .cellule {
    max-height: ${hauteurUtile}px; overflow: hidden; line-height: 1.15;
  }
  table.notes thead th {
    background: #7BA7D7; color: #fff; font-weight: bold; vertical-align: bottom;
    text-align: left; font-size: 10px; height: 34px;
  }
  table.notes td.num { text-align: right; font-variant-numeric: tabular-nums; }
  table.notes td.c-matiere { text-align: left; }
  table.notes tfoot td { font-weight: bold; font-style: italic; height: 18px; }

  table.pied { width: 100%; border-collapse: collapse; margin-top: auto; }
  table.pied > tbody > tr > td { border: 1px solid #000; padding: 5px 7px; vertical-align: top; }
  .titre-case {
    text-align: center; font-weight: bold; text-transform: uppercase;
    letter-spacing: 0.02em; border-bottom: 1px solid #000; padding-bottom: 2px;
    margin-bottom: 5px;
  }
  /* Libellé à gauche, zone à remplir à droite : les pointillés s'alignent tous
     sur la même colonne au lieu de commencer là où le mot finit. */
  table.champs { width: 100%; border-collapse: collapse; }
  table.champs th {
    font-weight: normal; text-align: left; white-space: nowrap; padding: 1px 0;
  }
  table.champs td { border-bottom: 1px dotted #000; width: 100%; padding: 1px 0 1px 6px; }
  table.champs td.suffixe { border: 0; width: 1%; padding-left: 4px; white-space: nowrap; }
  table.champs td.cases { border: 0; width: 1%; white-space: nowrap; text-align: right; }
  .case {
    display: inline-block; width: 30px; height: 12px; border: 1px solid #000;
    vertical-align: middle;
  }

  /* Bloc des résultats : un libellé, une valeur, une colonne de chiffres
     alignée. Les moyennes étaient réparties entre deux cellules du pied. */
  table.resultats { width: 100%; border-collapse: collapse; }
  table.resultats th { font-weight: normal; text-align: left; padding: 1.5px 0; }
  table.resultats td {
    text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums;
    padding: 1.5px 0;
  }
  table.resultats tr.forte th, table.resultats tr.forte td { font-weight: bold; }
  table.resultats tr.separateur th, table.resultats tr.separateur td {
    border-top: 1px solid #000; padding-top: 4px;
  }
  table.resultats .menu { font-weight: normal; font-size: 9.5px; }

  .ligne-vide { border-bottom: 1px dotted #000; height: 15px; }
  .ligne-vide + .ligne-vide { margin-top: 5px; }
  .zone-signature { height: 46px; }
${STYLE_IDENTITE}
</style>
</head>
<body>

  ${htmlFiligrane(identite)}
  <div class="entete">
    <div class="colonne">
      ${htmlLogo(identite)}
      <div class="ministere">
        Ministère des enseignements<br />primaire et secondaire
      </div>
      <div style="text-align:center; margin-top:2px;">${esc(etablissement.nom)}</div>
      <div style="text-align:center;">${esc(etablissement.ville)}</div>
      <div class="trait-court"></div>
      <div style="text-align:center;">${etablissement.telephone ? `Tél : ${esc(etablissement.telephone)}` : ''}</div>
    </div>

    <div class="colonne centre">
      <div style="margin-top:34px;">ANNEE SCOLAIRE</div>
      <div>${esc(anneeScolaireLibelle)}</div>
    </div>

    <div class="colonne droite">
      <div class="republique">REPUBLIQUE TOGOLAISE</div>
      <div class="devise">Travail-Liberté-Patrie</div>
      <div style="margin-top:18px;">${esc(periodeMajuscule)}</div>
      <div>Classe ${esc(classeNom)}</div>
      <div>Effectif ${synthese.effectifClasse}</div>
    </div>
  </div>

  <div class="titre-bulletin">Bulletin de Notes du ${esc(periodeMajuscule)}</div>

  <div class="bloc-sexe">
    <table>
      <tr><th>Sexe</th><th>Statut</th></tr>
      <tr><td class="valeur">${esc(sexeLibelle)}</td><td class="valeur"></td></tr>
    </table>
  </div>

  <div class="nom-eleve">
    Nom et prénoms de l'élève : ${esc(eleve.nom)} ${esc(eleve.prenoms)}
  </div>

  <table class="notes">
    <colgroup>
      <col style="width:13%" /><col style="width:8%" /><col style="width:8%" />
      <col style="width:8%" /><col style="width:5%" /><col style="width:8%" />
      <col style="width:6%" /><col style="width:16%" /><col style="width:16%" />
      <col style="width:12%" />
    </colgroup>
    <thead>
      <tr>
        <th>MATIERES</th>
        <th>Moy. Classe sur 20</th>
        <th>Compo sur 20</th>
        <th>Moy. Géné sur 20</th>
        <th>Coef</th>
        <th>Note Définitive</th>
        <th>Rang</th>
        <th>Appréciation du professeur</th>
        <th>Nom du Professeur</th>
        <th>Signature</th>
      </tr>
    </thead>
    <tbody>
      ${lignesRemplies}
    </tbody>
    <tfoot>
      <tr>
        <td>TOTAL</td>
        <td></td><td></td><td></td>
        <td class="num">${totalCoefficients || ''}</td>
        <td class="num">${totalPoints ? num(Number(totalPoints.toFixed(2))) : ''}</td>
        <td></td><td></td><td></td><td></td>
      </tr>
    </tfoot>
  </table>

  <table class="pied">
    <tbody>
      <tr>
        <td style="width:26%;">
          <div class="titre-case">Assiduité</div>
          <table class="champs">
            <tr><th>Absences</th><td></td><td class="suffixe">fois</td></tr>
            <tr><th>Retards</th><td></td><td class="suffixe">fois</td></tr>
            <tr><th>Punitions</th><td></td><td class="suffixe">fois</td></tr>
            <tr><th>Exclusions</th><td></td><td class="suffixe">fois</td></tr>
          </table>
        </td>
        <td style="width:31%;">
          <div class="titre-case">Distinctions et sanctions</div>
          <table class="champs">
            <tr><th>Tableau d'honneur</th><td></td></tr>
            <tr><th>Félicitations</th><td></td></tr>
            <tr><th>Encouragements</th><td></td></tr>
            <tr>
              <th>Avertissement</th>
              <td class="cases">Trav <span class="case"></span> Disc <span class="case"></span></td>
            </tr>
            <tr>
              <th>Blâme</th>
              <td class="cases">Trav <span class="case"></span> Disc <span class="case"></span></td>
            </tr>
          </table>
        </td>
        <td style="width:43%;">
          <div class="titre-case">Résultats</div>
          <table class="resultats">${lignesResultats}</table>
        </td>
      </tr>
      <tr>
        <td>
          <div class="titre-case">Décision du conseil</div>
          <div class="ligne-vide"></div>
          <div class="ligne-vide"></div>
          <div class="ligne-vide"></div>
        </td>
        <td>
          <div class="titre-case">Visa du titulaire</div>
          <div class="zone-signature"></div>
        </td>
        <td>
          <div class="titre-case">Observation du chef d'établissement</div>
          <div class="ligne-vide"></div>
          <div class="ligne-vide"></div>
          <div style="margin-top:8px; text-align:right;">
            Le <span style="display:inline-block; border-bottom:1px dotted #000; min-width:120px;"></span>
          </div>
          <div style="text-align:right; font-weight:bold;">Le Directeur</div>
        </td>
      </tr>
    </tbody>
  </table>

</body>
</html>`;
}

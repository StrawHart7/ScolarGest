import type { BulletinTemplateInput } from './bulletin';
import { STYLE_IDENTITE, htmlFiligrane, htmlLogo } from './identite';

/**
 * Bulletin officiel Collège / Lycée — République Togolaise, Ministère des
 * Enseignements Primaire et Secondaire.
 *
 * Fac-similé du modèle fourni par l'établissement : en-tête à trois colonnes,
 * encart Sexe/Statut, tableau des matières à neuf colonnes, puis le bloc de
 * bas de page (assiduité, distinctions, rappel des moyennes, décision du
 * conseil, observation du chef d'établissement).
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

export function renderBulletinSecondaireHtml(
  input: BulletinTemplateInput & { eleve: { sexe?: 'M' | 'F' } },
): string {
  const { etablissement, eleve, donnees, classeNom, anneeScolaireLibelle, periodeLabel, identite } =
    input;
  const synthese = donnees.synthese;

  const periodeMajuscule = periodeLabel.toUpperCase();
  const sexeLibelle = eleve.sexe === 'F' ? 'Féminin' : eleve.sexe === 'M' ? 'Masculin' : '';

  const lignesRemplies = donnees.matieres
    .map(
      (m) => `
      <tr>
        <td class="c-matiere">${esc(m.matiereNom)}</td>
        <td class="num">${num(m.moyClasse)}</td>
        <td class="num">${num(m.composition)}</td>
        <td class="num">${num(m.moyenneFinale)}</td>
        <td class="num">${m.coefficient || ''}</td>
        <td class="num">${num(noteDefinitive(m.moyenneFinale, m.coefficient))}</td>
        <td class="num">${m.rangMatiere ?? ''}</td>
        <td>${esc(appreciationMatiere(m.moyenneFinale))}</td>
        <td>${esc(m.professeurs)}</td>
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

  const ligneRang =
    synthese.rangGeneral !== null
      ? `${synthese.rangGeneral} sur ${synthese.effectifClasse} Elèves`
      : `sur ${synthese.effectifClasse} Elèves`;

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
  .titre-bulletin { text-align: center; font-weight: bold; margin: 14px 0 10px; font-size: 12px; }
  .bloc-sexe { border: 1px solid #000; width: 210px; margin-left: auto; }
  .bloc-sexe table { width: 100%; border-collapse: collapse; }
  .bloc-sexe td, .bloc-sexe th {
    border: 1px solid #000; padding: 2px 4px; font-weight: normal; text-align: left;
  }
  .bloc-sexe .valeur { text-align: center; height: 20px; }
  .nom-eleve { text-align: center; margin: 12px 0 8px; }

  table.notes { width: 100%; border-collapse: collapse; table-layout: fixed; }
  table.notes th, table.notes td { border: 1px solid #000; padding: 2px 3px; height: 17px; }
  table.notes thead th {
    background: #7BA7D7; color: #fff; font-weight: bold; vertical-align: bottom;
    text-align: left; font-size: 10px;
  }
  table.notes td.num { text-align: right; font-variant-numeric: tabular-nums; }
  table.notes td.c-matiere { text-align: left; }
  table.notes tfoot td { font-weight: bold; font-style: italic; }

  table.pied { width: 100%; border-collapse: collapse; margin-top: -1px; }
  table.pied td { border: 1px solid #000; padding: 4px 6px; vertical-align: top; }
  .pointilles { border-bottom: 1px dotted #000; display: inline-block; min-width: 60px; }
  .case { display: inline-block; width: 34px; height: 12px; border: 1px solid #000; vertical-align: middle; }
  .centre-titre { text-align: center; text-decoration: underline; }
  .ligne-vide { border-bottom: 1px dotted #000; height: 14px; margin-top: 6px; }
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
    <tr>
      <td style="width:22%;">
        Absences <span class="pointilles"></span>fois<br />
        Retards <span class="pointilles"></span>fois<br />
        Punition <span class="pointilles"></span>fois<br />
        Exclusions <span class="pointilles"></span>fois
      </td>
      <td style="width:33%;">
        Tableau d'honneur <span class="pointilles" style="min-width:120px;"></span><br />
        Félicitations <span class="pointilles" style="min-width:140px;"></span><br />
        Encouragements <span class="pointilles" style="min-width:130px;"></span><br />
        Avertissement Trav <span class="case"></span> Disc <span class="case"></span><br />
        Blâme <span class="case"></span> Trav <span class="case"></span> Disc <span class="case"></span>
      </td>
      <td style="width:45%;">
        <div class="centre-titre">RAPPEL DES MOYENNES</div>
        <div style="margin-top:4px;">
          Moyenne du ${esc(periodeMajuscule)}
          ${synthese.moyenneTrimestrielle !== null ? `${num(synthese.moyenneTrimestrielle)}/20` : '/20'},
          Rang ${ligneRang}
        </div>
        <div style="margin-top:8px;">
          MOYENNE ANNUELLE
          ${synthese.moyenneAnnuelle !== null ? `${num(synthese.moyenneAnnuelle)}` : ''}/20,
          Rang sur ${synthese.effectifClasse} Elèves
        </div>
      </td>
    </tr>
    <tr>
      <td>
        Moyenne du Semestre
        ${synthese.moyenneTrimestrielle !== null ? num(synthese.moyenneTrimestrielle) : ''} /20
        Rang ${synthese.rangGeneral ?? ''}<br />
        Moyenne plus forte
        ${synthese.meilleureMoyenneClasse !== null ? num(synthese.meilleureMoyenneClasse) : ''}<br />
        Moyenne plus faible
        ${synthese.plusFaibleMoyenneClasse !== null ? num(synthese.plusFaibleMoyenneClasse) : ''}
        <div style="margin-top:8px;">Moyenne Générale de la classe : ${
          synthese.moyenneGeneraleClasse !== null ? num(synthese.moyenneGeneraleClasse) : ''
        }</div>
        <div style="margin-top:10px;" class="centre-titre">Décision du conseil</div>
        <div class="ligne-vide"></div>
        <div class="ligne-vide"></div>
      </td>
      <td>
        <div style="text-align:center; text-decoration:underline;">Signature et nom du Titulaire</div>
        <div style="text-align:center; height:38px;"></div>
      </td>
      <td>
        <div style="text-align:center;">OBSERVATION DU CHEF D'ETABLISSEMENT</div>
        <div class="ligne-vide"></div>
        <div class="ligne-vide"></div>
        <div style="text-align:center; margin-top:8px;">Le ,<span class="pointilles" style="min-width:140px;"></span></div>
        <div style="text-align:center;">Le Directeur</div>
      </td>
    </tr>
  </table>

</body>
</html>`;
}

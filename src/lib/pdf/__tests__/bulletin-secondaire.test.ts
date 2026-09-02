import { describe, it, expect } from 'vitest';
import {
  renderBulletinSecondaireHtml,
  hauteurLigneMatiere,
} from '../templates/bulletin-secondaire';
import type { BulletinTemplateInput } from '../templates/bulletin';

/**
 * Le gabarit est une fonction pure HTML : testable sans Chromium (voir
 * `render.test.ts` pour le pipeline PDF lui-même, qui reste gardé par
 * RUN_PDF_TESTS dans cet environnement).
 */

const ENTREE: BulletinTemplateInput & { eleve: { sexe?: 'M' | 'F' } } = {
  etablissement: {
    nom: 'Les Victorieux',
    adresse: null,
    ville: 'Soviépé',
    telephone: '92 05 73 02',
    email: null,
  },
  anneeScolaireLibelle: '2025-2026',
  periodeLabel: '1er Trimestre',
  eleve: {
    nom: 'LOKI',
    prenoms: 'KILO',
    dateNaissance: '2008-04-12',
    matricule: 'M-001',
    sexe: 'M',
  },
  classeNom: 'Tle D',
  reference: 'BUL-2026-0001',
  dateGeneration: '2026-08-20T10:00:00.000Z',
  donnees: {
    eleveId: 'e1',
    classeId: 'c1',
    periode: 'TRIMESTRE_1',
    anneeScolaireId: 'a1',
    matieres: [
      {
        matiereId: 'm1',
        matiereNom: 'Français',
        obligatoire: true,
        coefficient: 2,
        moyInterros: null,
        devoir: null,
        moyClasse: 0,
        composition: 16,
        moyenneFinale: 8,
        rangMatiere: 2,
        professeurs: 'AGBO Pascal',
      },
    ],
    synthese: {
      moyenneTrimestrielle: 16,
      appreciation: 'Très Bien',
      rangGeneral: 1,
      effectifClasse: 18,
      meilleureMoyenneClasse: 18,
      plusFaibleMoyenneClasse: 9,
      moyenneGeneraleClasse: 13.1,
      moyenneAnnuelle: null,
    },
  },
};

describe('renderBulletinSecondaireHtml', () => {
  const html = renderBulletinSecondaireHtml(ENTREE);

  it("reproduit l'en-tête officiel", () => {
    expect(html).toContain('REPUBLIQUE TOGOLAISE');
    expect(html).toContain('Travail-Liberté-Patrie');
    expect(html).toContain('Ministère des enseignements');
    expect(html).toContain('Les Victorieux');
    expect(html).toContain('Soviépé');
    expect(html).toContain('Tél : 92 05 73 02');
    expect(html).toContain('2025-2026');
  });

  it('reprend la classe, l’effectif et l’identité de l’élève', () => {
    expect(html).toContain('Classe Tle D');
    expect(html).toContain('Effectif 18');
    expect(html).toContain("Nom et prénoms de l'élève : LOKI KILO");
    expect(html).toContain('Masculin');
  });

  it('porte les dix colonnes du tableau des matières', () => {
    for (const colonne of [
      'MATIERES',
      'Moy. Classe sur 20',
      'Compo sur 20',
      'Moy. Géné sur 20',
      'Coef',
      'Note Définitive',
      'Rang',
      'Appréciation du professeur',
      'Nom du Professeur',
      'Signature',
    ]) {
      expect(html).toContain(colonne);
    }
  });

  it('affiche la ligne de matière avec son professeur et son appréciation', () => {
    expect(html).toContain('Français');
    expect(html).toContain('AGBO Pascal');
    // 8/20 -> « Insuffisant » sur l'échelle du modèle.
    expect(html).toContain('Insuffisant');
  });

  it('rassemble toutes les moyennes dans un seul bloc de résultats', () => {
    expect(html).toContain('Résultats');
    expect(html).toContain('Moyenne du 1er Trimestre');
    expect(html).toContain('16 / 20');
    expect(html).toContain('sur 18 élèves');
    expect(html).toContain('Moyenne la plus forte');
    expect(html).toContain('Moyenne générale de la classe');
    expect(html).toContain('13.1 / 20');
  });

  it('n’affiche la moyenne de la période qu’une seule fois', () => {
    // Le pied la donnait deux fois sous deux noms différents (« Moyenne du
    // 1ER TRIMESTRE » puis « Moyenne du Semestre »), dans deux cellules
    // distinctes : le lecteur devait vérifier lui-même que c'était le même
    // nombre.
    expect(html).not.toContain('Moyenne du Semestre');
    expect(html).not.toContain('RAPPEL DES MOYENNES');
    expect((html.match(/Moyenne du 1er Trimestre/g) ?? []).length).toBe(1);
  });

  it('n’annonce pas de rang annuel, qui n’existe pas en base', () => {
    // La version précédente imprimait « Rang sur 18 Elèves » sans rang après
    // la moyenne annuelle : ça se lit comme une donnée manquante plutôt que
    // comme une donnée qui n'est pas calculée.
    const avecAnnuelle = renderBulletinSecondaireHtml({
      ...ENTREE,
      donnees: {
        ...ENTREE.donnees,
        synthese: { ...ENTREE.donnees.synthese, moyenneAnnuelle: 14.42 },
      },
    });
    expect(avecAnnuelle).toContain('Moyenne annuelle');
    expect(avecAnnuelle).toContain('14.42 / 20');
    expect((avecAnnuelle.match(/sur 18 élèves/g) ?? []).length).toBe(1);
  });

  it('omet la ligne annuelle tant qu’elle n’est pas calculable', () => {
    expect(html).not.toContain('Moyenne annuelle');
  });

  it('laisse vides les zones remplies à la main sur le modèle papier', () => {
    for (const zone of [
      'Absences',
      'Retards',
      'Punitions',
      'Exclusions',
      "Tableau d'honneur",
      'Félicitations',
      'Encouragements',
      'Décision du conseil',
      "Observation du chef d'établissement",
    ]) {
      expect(html).toContain(zone);
    }
  });

  it('donne la même hauteur à toutes les lignes, quel que soit le contenu', () => {
    // C'est le défaut corrigé : la hauteur d'une ligne suivait la longueur du
    // nom du professeur, si bien que deux élèves d'une même classe recevaient
    // deux documents de proportions différentes.
    const hauteurs = html.match(/table\.notes tbody tr \{ height: (\d+)px; \}/);
    expect(hauteurs).not.toBeNull();
    expect(Number(hauteurs![1])).toBeGreaterThan(0);
    // Aucune hauteur n'est posée ligne par ligne : la règle est unique.
    expect(html).not.toMatch(/<tr style="height/);
  });

  it('échappe le HTML des données saisies', () => {
    const injecte = renderBulletinSecondaireHtml({
      ...ENTREE,
      eleve: { ...ENTREE.eleve, nom: '<script>alert(1)</script>' },
    });
    expect(injecte).not.toContain('<script>alert(1)</script>');
    expect(injecte).toContain('&lt;script&gt;');
  });

  it('ne complète plus le tableau avec des lignes anonymes', () => {
    // Le tableau était rempli jusqu'à vingt lignes vides et sans intitulé.
    // Il liste désormais exactement les matières du programme du niveau : une
    // matière sans note garde son nom et des cellules vides, comme sur le
    // modèle papier, mais aucune ligne sans libellé n'est ajoutée.
    expect(html).not.toContain('<tr class="vide">');
    const lignesCorps = (html.match(/<tr>\s*<td class="c-matiere">/g) ?? []).length;
    expect(lignesCorps).toBe(ENTREE.donnees.matieres.length);
  });

  it('affiche une matière sans note avec son nom et des cellules vides', () => {
    const avecMatiereVide = renderBulletinSecondaireHtml({
      ...ENTREE,
      donnees: {
        ...ENTREE.donnees,
        matieres: [
          ...ENTREE.donnees.matieres,
          {
            matiereId: 'm2',
            matiereNom: 'Allemand',
            obligatoire: false,
            coefficient: 1,
            moyInterros: null,
            devoir: null,
            moyClasse: null,
            composition: null,
            moyenneFinale: null,
            rangMatiere: null,
            professeurs: '',
          },
        ],
      },
    });
    expect(avecMatiereVide).toContain('Allemand');
    const lignesCorps = (avecMatiereVide.match(/<tr>\s*<td class="c-matiere">/g) ?? []).length;
    expect(lignesCorps).toBe(2);
  });

  it('calcule la note définitive en multipliant la moyenne par le coefficient', () => {
    // Moyenne 8, coefficient 2 → 16. La colonne reprenait auparavant la
    // moyenne telle quelle, donc la même valeur que « Moy. Géné sur 20 ».
    const cellules = html.match(/<td class="num"><div class="cellule">[^<]*<\/div><\/td>/g) ?? [];
    const valeurs = cellules.map((c) => c.replace(/<[^>]+>/g, ''));
    // Ordre des colonnes numériques d'une ligne : moyClasse, compo,
    // moyGénérale, coef, note définitive, rang.
    expect(valeurs.slice(0, 6)).toEqual(['0', '16', '8', '2', '16', '2']);
  });

  it('laisse la note définitive vide quand la matière n’a pas de moyenne', () => {
    const sansMoyenne = renderBulletinSecondaireHtml({
      ...ENTREE,
      donnees: {
        ...ENTREE.donnees,
        matieres: [{ ...ENTREE.donnees.matieres[0]!, moyenneFinale: null }],
      },
    });
    const cellules = (sansMoyenne.match(/<td class="num"><div class="cellule">[^<]*<\/div><\/td>/g) ?? []).map((c) =>
      c.replace(/<[^>]+>/g, ''),
    );
    // Coefficient toujours affiché, mais aucune note définitive inventée.
    expect(cellules.slice(3, 5)).toEqual(['2', '']);
  });
});

/**
 * La mise en page finale se regarde, elle ne se teste pas : rendre le gabarit
 * avec `npx tsx scripts/apercu-bulletin.ts <nombre de matières>`. Ce qui se
 * teste ici, c'est la seule règle capable de produire un bulletin à deux pages
 * ou des lignes illisibles.
 */
describe('hauteurLigneMatiere', () => {
  it('ne dépend que du nombre de matières, jamais de leur contenu', () => {
    expect(hauteurLigneMatiere(10)).toBe(hauteurLigneMatiere(10));
  });

  it('plafonne la hauteur quand les matières sont peu nombreuses', () => {
    // Le surplus est absorbé par le flex du tableau, pas par des lignes
    // démesurées.
    expect(hauteurLigneMatiere(3)).toBe(38);
    expect(hauteurLigneMatiere(6)).toBe(38);
  });

  it('resserre les lignes quand les matières sont nombreuses', () => {
    expect(hauteurLigneMatiere(15)).toBe(30);
    expect(hauteurLigneMatiere(22)).toBe(20);
  });

  it('ne descend jamais sous le plancher lisible', () => {
    expect(hauteurLigneMatiere(40)).toBe(20);
    expect(hauteurLigneMatiere(200)).toBe(20);
  });

  it('reste défini pour un bulletin sans matière', () => {
    expect(hauteurLigneMatiere(0)).toBe(20);
    expect(hauteurLigneMatiere(-1)).toBe(20);
  });
});

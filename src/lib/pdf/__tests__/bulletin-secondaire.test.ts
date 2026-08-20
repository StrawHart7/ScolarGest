import { describe, it, expect } from 'vitest';
import { renderBulletinSecondaireHtml } from '../templates/bulletin-secondaire';
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

  it('reprend le rappel des moyennes et les statistiques de classe', () => {
    expect(html).toContain('RAPPEL DES MOYENNES');
    expect(html).toContain('Rang 1 sur 18 Elèves');
    expect(html).toContain('Moyenne plus forte');
    expect(html).toContain('Moyenne Générale de la classe : 13.1');
  });

  it('laisse vides les zones remplies à la main sur le modèle papier', () => {
    for (const zone of [
      'Absences',
      'Retards',
      'Punition',
      'Exclusions',
      "Tableau d'honneur",
      'Félicitations',
      'Encouragements',
      'Décision du conseil',
      "OBSERVATION DU CHEF D'ETABLISSEMENT",
    ]) {
      expect(html).toContain(zone);
    }
  });

  it('échappe le HTML des données saisies', () => {
    const injecte = renderBulletinSecondaireHtml({
      ...ENTREE,
      eleve: { ...ENTREE.eleve, nom: '<script>alert(1)</script>' },
    });
    expect(injecte).not.toContain('<script>alert(1)</script>');
    expect(injecte).toContain('&lt;script&gt;');
  });

  it('complète le tableau jusqu’à vingt lignes, comme le modèle', () => {
    const lignesVides = (html.match(/<tr class="vide">/g) ?? []).length;
    expect(lignesVides).toBe(19);
  });
});

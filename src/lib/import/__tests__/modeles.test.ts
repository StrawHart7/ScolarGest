import { describe, it, expect } from 'vitest';
import { MODELES, modeleCoherent, type DomaineImport } from '../modeles';
import { ELEVE_IMPORT_COLUMNS } from '../eleve-import-schema';
import { ENSEIGNANT_IMPORT_COLUMNS } from '../enseignant-import-schema';
import { PAIEMENT_IMPORT_COLUMNS } from '../paiement-import-schema';

const DOMAINES = Object.keys(MODELES) as DomaineImport[];

const COLONNES_ATTENDUES: Record<DomaineImport, readonly string[]> = {
  eleves: ELEVE_IMPORT_COLUMNS,
  enseignants: ENSEIGNANT_IMPORT_COLUMNS,
  paiements: PAIEMENT_IMPORT_COLUMNS,
};

/**
 * Le modèle distribué doit être exactement celui que l'import attend.
 *
 * C'est tout l'intérêt de le générer depuis les schémas plutôt que de déposer
 * un `.xlsx` dans `public/` : le jour où une colonne change, un fichier statique
 * continuerait de distribuer l'ancienne, et l'école recevrait de nos mains un
 * fichier que le produit refuse. Ces tests verrouillent l'accord.
 */
describe('les modèles de fichier d’import', () => {
  it('reprend exactement les colonnes du schéma, dans le même ordre', () => {
    for (const domaine of DOMAINES) {
      expect(
        MODELES[domaine].colonnes.map((c) => c.cle),
        `le modèle « ${domaine} » ne suit plus son schéma`,
      ).toEqual([...COLONNES_ATTENDUES[domaine]]);
    }
  });

  it('aligne la ligne d’exemple sur les colonnes', () => {
    // Un exemple décalé est pire qu'un modèle sans exemple : il est recopié
    // tel quel, et l'école remplit la mauvaise colonne sans le voir.
    for (const domaine of DOMAINES) {
      expect(modeleCoherent(MODELES[domaine]), `exemple désaligné pour « ${domaine} »`).toBe(true);
    }
  });

  it('décrit chaque colonne', () => {
    // Une description vide laisse deviner ce qu'on attend — le défaut qu'on
    // répare. Le nom technique seul ne dit pas le format d'une date.
    for (const domaine of DOMAINES) {
      for (const colonne of MODELES[domaine].colonnes) {
        expect(
          colonne.description.trim().length,
          `${domaine}/${colonne.cle} n'est pas décrite`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it('remplit toutes les colonnes obligatoires dans l’exemple', () => {
    // Un exemple qui laisse vide une colonne obligatoire enseigne l'inverse de
    // ce qu'il faut faire.
    for (const domaine of DOMAINES) {
      const modele = MODELES[domaine];
      modele.colonnes.forEach((colonne, index) => {
        if (!colonne.obligatoire) return;
        expect(
          (modele.exemple[index] ?? '').trim().length,
          `${domaine}/${colonne.cle} est obligatoire mais vide dans l'exemple`,
        ).toBeGreaterThan(0);
      });
    }
  });

  it('déclare au moins une colonne obligatoire par domaine', () => {
    for (const domaine of DOMAINES) {
      expect(
        MODELES[domaine].colonnes.some((c) => c.obligatoire),
        `aucune colonne obligatoire pour « ${domaine} »`,
      ).toBe(true);
    }
  });

  it('donne un nom de fichier propre à chaque modèle', () => {
    const noms = DOMAINES.map((d) => MODELES[d].fichier);
    expect(new Set(noms).size).toBe(noms.length);
    for (const nom of noms) expect(nom).toMatch(/^[a-z0-9-]+$/);
  });
});

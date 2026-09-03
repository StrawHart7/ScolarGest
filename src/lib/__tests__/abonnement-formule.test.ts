import { describe, it, expect } from 'vitest';
import {
  nomFormule,
  formulesPour,
  prixPourCycles,
  MOIS_OFFERTS_ANNUEL,
  PRIX_MENSUEL_PAR_CYCLE,
  PRIX_ANNUEL_PAR_CYCLE,
} from '../abonnement-formule';

/**
 * L'oracle est calculé à la main : 10 000 F/mois et 100 000 F/an par cycle,
 * donc un complexe collège + lycée paie 20 000 F/mois ou 200 000 F/an.
 * Vérifier le moteur avec le moteur ne prouverait rien.
 */

describe('nomFormule', () => {
  it('nomme un cycle unique', () => {
    expect(nomFormule(['COLLEGE'])).toBe('Collège');
  });

  it('suit l ordre du cursus, pas l ordre d activation', () => {
    // « Lycée + Collège » fait hésiter le lecteur ; « Collège + Lycée » se lit.
    expect(nomFormule(['LYCEE', 'COLLEGE'])).toBe('Collège + Lycée');
  });

  it('nomme encore les cycles retirés du catalogue', () => {
    // Une école entrée avant le recentrage sur le secondaire garde ses classes
    // de primaire : son abonnement doit pouvoir se nommer.
    expect(nomFormule(['PRIMAIRE', 'COLLEGE'])).toBe('Primaire + Collège');
  });

  it('reste lisible pour une école qui n a encore rien activé', () => {
    expect(nomFormule([])).toBe('Formule de base');
  });
});

describe('prixPourCycles', () => {
  it('facture un cycle au tarif du catalogue', () => {
    expect(prixPourCycles(1, 'MOIS')).toBe(10_000);
    expect(prixPourCycles(1, 'AN')).toBe(100_000);
  });

  it('double pour un complexe collège et lycée', () => {
    expect(prixPourCycles(2, 'MOIS')).toBe(20_000);
    expect(prixPourCycles(2, 'AN')).toBe(200_000);
  });
});

describe('MOIS_OFFERTS_ANNUEL', () => {
  it('vaut deux mois, calculé et non écrit en dur', () => {
    // Un prix modifié sans mettre à jour un « 2 mois offerts » figé
    // afficherait un avantage faux sur une page commerciale.
    expect(MOIS_OFFERTS_ANNUEL).toBe(2);
    expect(PRIX_ANNUEL_PAR_CYCLE).toBe(PRIX_MENSUEL_PAR_CYCLE * 10);
  });
});

describe('formulesPour', () => {
  it('ne propose que la quantité réellement exploitée', () => {
    // Montrer aussi la formule « un cycle » à une école qui en exploite deux
    // l inviterait à sous-souscrire, puis à découvrir l écart au paiement.
    const formules = formulesPour(['COLLEGE', 'LYCEE']);
    expect(formules).toHaveLength(2);
    expect(formules.every((f) => f.nombreCycles === 2)).toBe(true);
    expect(formules.every((f) => f.nomFormule === 'Collège + Lycée')).toBe(true);
  });

  it('nomme la formule avec sa périodicité', () => {
    const formules = formulesPour(['COLLEGE']);
    expect(formules.map((f) => f.libelle)).toEqual([
      'Collège — Mensuel',
      'Collège — Annuel',
    ]);
  });

  it('affiche le montant formaté avec son unité', () => {
    const [mensuelle, annuelle] = formulesPour(['COLLEGE', 'LYCEE']);
    expect(mensuelle!.montant).toBe(20_000);
    expect(mensuelle!.montantLibelle).toContain('/ mois');
    expect(annuelle!.montant).toBe(200_000);
    expect(annuelle!.montantLibelle).toContain('/ an');
  });

  it('facture une unité à une école qui n a encore activé aucun cycle', () => {
    // Facturer zéro ouvrirait un abonnement gratuit à qui saute l étape des
    // cycles pendant la configuration.
    const formules = formulesPour([]);
    expect(formules.every((f) => f.nombreCycles === 1)).toBe(true);
    expect(formules[0]!.montant).toBe(10_000);
  });

  it("ne met d'argument commercial que sur la formule annuelle", () => {
    const formules = formulesPour(['COLLEGE']);
    expect(formules.find((f) => f.periodicite === 'MOIS')!.avantage).toBeNull();
    expect(formules.find((f) => f.periodicite === 'AN')!.avantage).toContain('2 mois offerts');
  });
});

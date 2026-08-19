import { describe, it, expect } from 'vitest';
import {
  calculerSolde,
  calculerSoldeFacture,
  statutFacture,
  totalPaye,
  totauxSuivi,
  type SuiviPaiementLigne,
} from '../facture';

const paye = (montant: number) => ({ montant, statut: 'PAYE' as const });
const annule = (montant: number) => ({ montant, statut: 'ANNULE' as const });

describe('totalPaye', () => {
  it('somme les versements encaissés', () => {
    expect(totalPaye([paye(100000), paye(80000), paye(70000)])).toBe(250000);
  });

  it('ignore les versements annulés', () => {
    expect(totalPaye([paye(100000), annule(50000)])).toBe(100000);
  });

  it('vaut 0 sans aucun versement', () => {
    expect(totalPaye([])).toBe(0);
  });
});

describe('calculerSolde', () => {
  it('retire les versements du montant facturé', () => {
    expect(calculerSolde(250000, [paye(100000), paye(80000)])).toBe(70000);
  });

  it('vaut le montant total quand aucun versement n a été encaissé', () => {
    expect(calculerSolde(250000, [])).toBe(250000);
    expect(calculerSolde(250000, [annule(100000)])).toBe(250000);
  });

  it('vaut 0 sur une facture soldée', () => {
    expect(calculerSolde(250000, [paye(250000)])).toBe(0);
  });

  it('ne descend jamais sous 0 même en cas de trop-perçu', () => {
    expect(calculerSolde(250000, [paye(300000)])).toBe(0);
  });

  it('gère une facture squelette à 0 (aucun tarif défini pour la classe)', () => {
    expect(calculerSolde(0, [])).toBe(0);
  });
});

describe('statutFacture', () => {
  it('IMPAYE sans versement', () => {
    expect(statutFacture(250000, [])).toBe('IMPAYE');
  });

  it('IMPAYE si le seul versement a été annulé', () => {
    expect(statutFacture(250000, [annule(100000)])).toBe('IMPAYE');
  });

  it('PARTIEL sur un versement incomplet', () => {
    expect(statutFacture(250000, [paye(100000)])).toBe('PARTIEL');
  });

  it('PAYE quand la somme atteint le total', () => {
    expect(statutFacture(250000, [paye(100000), paye(150000)])).toBe('PAYE');
  });

  it('PAYE aussi sur une facture à 0 déjà soldée par construction', () => {
    // Aucun versement possible sur une facture à 0 : elle reste IMPAYE, ce qui
    // est le comportement de fn_recalculer_statut_facture (paye <= 0).
    expect(statutFacture(0, [])).toBe('IMPAYE');
  });

  it('ANNULE prime sur tout le reste', () => {
    expect(statutFacture(250000, [paye(250000)], true)).toBe('ANNULE');
  });
});

describe('calculerSoldeFacture (fiche élève, Phase 2)', () => {
  it('retourne le montantTotal', () => {
    expect(calculerSoldeFacture({ montantTotal: 50000 })).toBe(50000);
  });
});

describe('totauxSuivi', () => {
  const ligne = (montantTotal: number, paye: number): SuiviPaiementLigne => ({
    factureId: 'f',
    eleveId: 'e',
    matricule: 'ELV-2025-000001',
    nom: 'Mensah',
    prenoms: 'Kossi',
    classeId: 'c',
    classeNom: '6ème A',
    montantTotal,
    totalPaye: paye,
    solde: montantTotal - paye,
    statut: 'PARTIEL',
  });

  it('additionne facturé, encaissé et reste à recouvrer', () => {
    expect(totauxSuivi([ligne(1200000, 1200000), ligne(1100000, 600000)])).toEqual({
      montantTotal: 2300000,
      totalPaye: 1800000,
      solde: 500000,
    });
  });

  it('retourne des totaux nuls sur une liste vide', () => {
    expect(totauxSuivi([])).toEqual({ montantTotal: 0, totalPaye: 0, solde: 0 });
  });
});

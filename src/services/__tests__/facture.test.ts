import { describe, it, expect } from 'vitest';
import {
  calculerSolde,
  calculerSoldeFacture,
  soldeDuAvecStatut,
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

describe('soldeDuAvecStatut', () => {
  it('se comporte comme calculerSolde tant que la facture est en vigueur', () => {
    expect(soldeDuAvecStatut(1200000, [paye(500000)], 'PARTIEL')).toBe(700000);
  });

  it('ne réclame plus rien sur une facture annulée', () => {
    // Le cas du testeur : inscription changée de classe, ancienne facture
    // annulée. Le montant restait dû à l'écran.
    expect(soldeDuAvecStatut(178000, [], 'ANNULE')).toBe(0);
  });

  it('ne réclame rien non plus sur une annulée partiellement réglée', () => {
    expect(soldeDuAvecStatut(178000, [paye(50000)], 'ANNULE')).toBe(0);
  });
});

describe('totauxSuivi', () => {
  const ligne = (
    montantTotal: number,
    paye: number,
    statut: SuiviPaiementLigne['statut'] = 'PARTIEL',
  ): SuiviPaiementLigne => ({
    factureId: 'f',
    eleveId: 'e',
    matricule: 'ELV-2025-000001',
    nom: 'Mensah',
    prenoms: 'Kossi',
    classeId: 'c',
    classeNom: '6ème A',
    montantTotal,
    totalPaye: paye,
    solde: soldeDuAvecStatut(montantTotal, [{ montant: paye, statut: 'PAYE' }], statut),
    statut,
  });

  it('additionne facturé, encaissé et reste à recouvrer', () => {
    expect(totauxSuivi([ligne(1200000, 1200000), ligne(1100000, 600000)])).toEqual({
      montantTotal: 2300000,
      totalPaye: 1800000,
      solde: 500000,
      annulees: 0,
    });
  });

  it('retourne des totaux nuls sur une liste vide', () => {
    expect(totauxSuivi([])).toEqual({ montantTotal: 0, totalPaye: 0, solde: 0, annulees: 0 });
  });

  /**
   * Oracle à la main, sur les chiffres réels du testeur (Complexe Scolaire La
   * Semence, 2026-09-16) : deux factures, l'une de 178 000 annulée après un
   * changement de classe, l'autre de 169 000 dont 78 000 encaissés. L'écran
   * annonçait 347 000 dus et 269 000 à recouvrer, soit la facture annulée
   * réclamée deux fois — une fois dans le dû, une fois dans le reste.
   */
  it('écarte une facture annulée du total dû et du reste à recouvrer', () => {
    const totaux = totauxSuivi([ligne(178000, 0, 'ANNULE'), ligne(169000, 78000)]);
    expect(totaux.montantTotal).toBe(169000);
    expect(totaux.solde).toBe(91000);
    expect(totaux.annulees).toBe(1);
  });

  it('garde dans l’encaissé l’argent reçu sur une facture ensuite annulée', () => {
    // L'annulation ne rend pas l'argent : le retirer de l'encaissé ferait
    // disparaître de la caisse un versement bien réel, et masquerait le
    // remboursement dû à la famille.
    const totaux = totauxSuivi([ligne(178000, 50000, 'ANNULE')]);
    expect(totaux.montantTotal).toBe(0);
    expect(totaux.totalPaye).toBe(50000);
    expect(totaux.solde).toBe(0);
  });
});

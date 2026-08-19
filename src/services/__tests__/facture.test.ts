import { describe, it, expect } from 'vitest';
import { calculerSoldeFacture } from '../facture';

describe('calculerSoldeFacture', () => {
  it('retourne le montantTotal comme solde (aucun paiement géré en Phase 2)', () => {
    expect(calculerSoldeFacture({ montantTotal: 50000 })).toBe(50000);
  });

  it('retourne 0 pour une facture squelette sans tarif', () => {
    expect(calculerSoldeFacture({ montantTotal: 0 })).toBe(0);
  });
});

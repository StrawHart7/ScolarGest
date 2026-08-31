import { describe, it, expect } from 'vitest';
import { normaliserNumero, trouverPays, PAYS_FEDAPAY } from '../pays';

/**
 * La normalisation décide de la réussite d'un paiement : FedaPay attend le
 * numéro national, chiffres seuls. Un indicatif oublié ou un espace laissé
 * produit un refus que l'école ne peut pas interpréter.
 */
describe('normaliserNumero', () => {
  it('accepte un numéro togolais à 8 chiffres', () => {
    expect(normaliserNumero('90123456', 'tg')).toEqual({ ok: true, numero: '90123456' });
  });

  it('retire les séparateurs de saisie', () => {
    // Un utilisateur qui recopie depuis un carnet écrit rarement d'un trait.
    expect(normaliserNumero('90 12 34 56', 'tg').numero).toBe('90123456');
    expect(normaliserNumero('90-12-34-56', 'tg').numero).toBe('90123456');
    expect(normaliserNumero('(90) 12.34.56', 'tg').numero).toBe('90123456');
  });

  it('retire l indicatif sous ses trois formes usuelles', () => {
    expect(normaliserNumero('+228 90123456', 'tg').numero).toBe('90123456');
    expect(normaliserNumero('00228 90123456', 'tg').numero).toBe('90123456');
    expect(normaliserNumero('228 90123456', 'tg').numero).toBe('90123456');
  });

  it('ne retire pas un préfixe qui ressemble à l indicatif mais n en est pas un', () => {
    // 22890123 est un numéro togolais valide de 8 chiffres commençant par 228.
    // Le raccourcir donnerait 90123, trop court, et un paiement refusé.
    expect(normaliserNumero('22890123', 'tg').numero).toBe('22890123');
  });

  it('refuse un numéro trop court ou trop long, avec un message utilisable', () => {
    const court = normaliserNumero('9012', 'tg');
    expect(court.ok).toBe(false);
    expect(court.message).toContain('8 chiffres');
    expect(court.message).toContain('90 12 34 56');

    expect(normaliserNumero('901234567890', 'tg').ok).toBe(false);
  });

  it('refuse une saisie vide', () => {
    expect(normaliserNumero('   ', 'tg').ok).toBe(false);
  });

  it('refuse un pays hors périmètre FedaPay', () => {
    // Proposer le Sénégal afficherait un choix qui échouerait au paiement.
    expect(normaliserNumero('771234567', 'sn').ok).toBe(false);
  });

  it('accepte les deux longueurs béninoises, ancien et nouveau plan', () => {
    // Le Bénin est passé à dix chiffres, mais les numéros de test de FedaPay
    // en font huit : les deux doivent passer.
    expect(normaliserNumero('64000001', 'bj')).toEqual({ ok: true, numero: '64000001' });
    expect(normaliserNumero('0197000000', 'bj').ok).toBe(true);
  });

  it('accepte les numéros de test documentés du bac à sable', () => {
    expect(normaliserNumero('64000001', 'bj').ok).toBe(true);
    expect(normaliserNumero('66000001', 'bj').ok).toBe(true);
  });
});

describe('catalogue des pays', () => {
  it('n expose que des codes ISO en minuscules, comme FedaPay les attend', () => {
    for (const pays of PAYS_FEDAPAY) {
      expect(pays.code).toBe(pays.code.toLowerCase());
      expect(pays.code).toHaveLength(2);
    }
  });

  it('donne un exemple cohérent avec la longueur annoncée', () => {
    // Un exemple faux dans un message d'erreur est pire que pas d'exemple.
    for (const pays of PAYS_FEDAPAY) {
      const chiffres = pays.exemple.replace(/\D/g, '').length;
      expect(chiffres).toBeGreaterThanOrEqual(pays.longueurMin);
      expect(chiffres).toBeLessThanOrEqual(pays.longueurMax);
    }
  });

  it('résout un pays connu et rejette le reste', () => {
    expect(trouverPays('tg')?.indicatif).toBe('+228');
    expect(trouverPays('xx')).toBeUndefined();
  });
});

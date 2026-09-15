import { describe, it, expect } from 'vitest';
import { nommerClasse, prochainNomClasse, rangAtteint } from '../noms-classes';

/**
 * Le nom d'une classe est composé, jamais saisi — et c'est ce qui permet de le
 * déduire. Les deux chemins de création divergeaient : l'onboarding produisait
 * « Terminale D1, D2 », la création manuelle « Terminale D A ». Dans la même
 * école.
 */
describe('nommerClasse', () => {
  it('ne met pas d’indice sur la première', () => {
    // Une école qui n'a qu'une sixième l'appelle « 6ème ». La lettre se lirait
    // comme la promesse d'une 6ème B qui n'existe pas.
    expect(nommerClasse('6ème', null, 1)).toBe('6ème');
    expect(nommerClasse('Terminale', 'D', 1)).toBe('Terminale D');
  });

  it('colle le chiffre à la série au lycée, sépare la lettre au collège', () => {
    expect(nommerClasse('Terminale', 'D', 2)).toBe('Terminale D2');
    expect(nommerClasse('Terminale', 'D', 3)).toBe('Terminale D3');
    expect(nommerClasse('6ème', null, 2)).toBe('6ème B');
    expect(nommerClasse('6ème', null, 3)).toBe('6ème C');
  });

  it('retombe sur un chiffre au-delà de l’alphabet retenu', () => {
    expect(nommerClasse('6ème', null, 11)).toBe('6ème 11');
  });
});

describe('rangAtteint', () => {
  it('compte le nom nu comme le rang 1', () => {
    expect(rangAtteint('6ème', null, ['6ème'])).toBe(1);
    expect(rangAtteint('Terminale', 'D', ['Terminale D'])).toBe(1);
  });

  it('lit les chiffres du lycée et les lettres du collège', () => {
    expect(rangAtteint('Terminale', 'D', ['Terminale D1', 'Terminale D2'])).toBe(2);
    expect(rangAtteint('6ème', null, ['6ème A', '6ème C'])).toBe(3);
  });

  it('ne confond pas deux séries qui se ressemblent', () => {
    // « Terminale D » ne doit pas compter les « Terminale D » d'une autre
    // série… mais surtout pas compter « Terminale C » non plus.
    expect(rangAtteint('Terminale', 'C', ['Terminale D1', 'Terminale D2'])).toBe(0);
  });

  it('ignore la casse et les espaces de bord', () => {
    // Les noms sont composés par le produit, mais une école peut en avoir
    // hérité d'un import ou d'un ancien système : « 6EME B » désigne la même
    // classe que « 6ème B », et la manquer créerait un doublon.
    expect(rangAtteint('6ème', null, ['  6ÈME b '])).toBe(2);
    expect(rangAtteint('6ème', null, ['  6ème b '])).toBe(2);
  });

  it('compte un nom inconnu pour 1 plutôt que de l’ignorer', () => {
    // Prudence : mieux vaut décaler la suivante que fabriquer un nom déjà pris.
    expect(rangAtteint('6ème', null, ['6ème bis'])).toBe(1);
  });

  it('rend zéro quand rien n’existe', () => {
    expect(rangAtteint('5ème', null, ['6ème A', 'Terminale D1'])).toBe(0);
  });
});

describe('prochainNomClasse', () => {
  it('continue la série existante — le cas demandé', () => {
    // « S'il y a déjà Terminale D1 et D2, la nouvelle doit être D3. »
    expect(prochainNomClasse('Terminale', 'D', ['Terminale D1', 'Terminale D2'])).toBe(
      'Terminale D3',
    );
  });

  it('démarre sans indice sur une école neuve', () => {
    expect(prochainNomClasse('6ème', null, [])).toBe('6ème');
  });

  it('enchaîne sur une classe qui n’avait pas d’indice', () => {
    // La première n'est **pas** renommée : son nom figure sur des bulletins
    // déjà remis aux familles.
    expect(prochainNomClasse('6ème', null, ['6ème'])).toBe('6ème B');
    expect(prochainNomClasse('Terminale', 'D', ['Terminale D'])).toBe('Terminale D2');
  });
});

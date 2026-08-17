import { describe, it, expect } from 'vitest';
import {
  arrondi2,
  moyenneInterros,
  moyenneClasse,
  moyenneMatiere,
  moyenneTrimestrielle,
  moyenneAnnuelle,
  appreciation,
  classement,
} from './calcul-moyennes';

describe('arrondi2', () => {
  it('arrondit à 2 décimales', () => {
    expect(arrondi2(12.345)).toBe(12.35);
    expect(arrondi2(12.344)).toBe(12.34);
    expect(arrondi2(0)).toBe(0);
  });
});

describe('moyenneInterros', () => {
  it('null si aucune interro', () => {
    expect(moyenneInterros([])).toBeNull();
  });
  it('1 interro = valeur', () => {
    expect(moyenneInterros([14])).toBe(14);
  });
  it('2 interros', () => {
    expect(moyenneInterros([10, 14])).toBe(12);
  });
  it('3 interros', () => {
    expect(moyenneInterros([10, 12, 14])).toBe(12);
  });
});

describe('moyenneClasse', () => {
  it('les deux composantes', () => {
    expect(moyenneClasse(10, 14)).toBe(12);
  });
  it('devoir manquant → moy interros', () => {
    expect(moyenneClasse(10, null)).toBe(10);
  });
  it('interros manquantes → devoir', () => {
    expect(moyenneClasse(null, 14)).toBe(14);
  });
  it('les deux null → null', () => {
    expect(moyenneClasse(null, null)).toBeNull();
  });
});

describe('moyenneMatiere', () => {
  it('les deux composantes', () => {
    expect(moyenneMatiere(12, 16)).toBe(14);
  });
  it('composition manquante', () => {
    expect(moyenneMatiere(12, null)).toBe(12);
  });
  it('classe manquante', () => {
    expect(moyenneMatiere(null, 16)).toBe(16);
  });
  it('tout null', () => {
    expect(moyenneMatiere(null, null)).toBeNull();
  });
});

describe('moyenneTrimestrielle', () => {
  it('cas standard pondéré', () => {
    const items = [
      { moyenne: 12, coefficient: 4, obligatoire: true },
      { moyenne: 15, coefficient: 2, obligatoire: true },
      { moyenne: 10, coefficient: 1, obligatoire: true },
    ];
    // (48 + 30 + 10) / 7 = 88/7 ≈ 12.57
    expect(moyenneTrimestrielle(items)).toBe(12.57);
  });
  it('matière facultative sans note → exclue', () => {
    const items = [
      { moyenne: 12, coefficient: 4, obligatoire: true },
      { moyenne: null, coefficient: 2, obligatoire: false },
    ];
    expect(moyenneTrimestrielle(items)).toBe(12);
  });
  it('matière obligatoire sans note → comptée à 0', () => {
    const items = [
      { moyenne: 12, coefficient: 4, obligatoire: true },
      { moyenne: null, coefficient: 4, obligatoire: true },
    ];
    // (48 + 0) / 8 = 6
    expect(moyenneTrimestrielle(items)).toBe(6);
  });
  it('coefficient 0 → ignoré', () => {
    const items = [
      { moyenne: 20, coefficient: 0, obligatoire: true },
      { moyenne: 10, coefficient: 2, obligatoire: true },
    ];
    expect(moyenneTrimestrielle(items)).toBe(10);
  });
  it('tout null / facultatives → null', () => {
    const items = [
      { moyenne: null, coefficient: 2, obligatoire: false },
      { moyenne: null, coefficient: 4, obligatoire: false },
    ];
    expect(moyenneTrimestrielle(items)).toBeNull();
  });
  it('liste vide → null', () => {
    expect(moyenneTrimestrielle([])).toBeNull();
  });
});

describe('moyenneAnnuelle', () => {
  it('3 trimestres', () => {
    expect(moyenneAnnuelle(10, 12, 14)).toBe(12);
  });
  it('trimestre manquant', () => {
    expect(moyenneAnnuelle(10, null, 14)).toBe(12);
  });
  it('un seul trimestre', () => {
    expect(moyenneAnnuelle(15, null, null)).toBe(15);
  });
  it('tout null', () => {
    expect(moyenneAnnuelle(null, null, null)).toBeNull();
  });
});

describe('appreciation', () => {
  it('bornes tranches', () => {
    expect(appreciation(0)).toBe('Très faible');
    expect(appreciation(5.99)).toBe('Très faible');
    expect(appreciation(6)).toBe('Faible');
    expect(appreciation(7.99)).toBe('Faible');
    expect(appreciation(8)).toBe('Insuffisant');
    expect(appreciation(9.99)).toBe('Insuffisant');
    expect(appreciation(10)).toBe('Passable');
    expect(appreciation(11.99)).toBe('Passable');
    expect(appreciation(12)).toBe('Assez bien');
    expect(appreciation(13.99)).toBe('Assez bien');
    expect(appreciation(14)).toBe('Bien');
    expect(appreciation(15.99)).toBe('Bien');
    expect(appreciation(16)).toBe('Très bien');
    expect(appreciation(17.99)).toBe('Très bien');
    expect(appreciation(18)).toBe('Excellent');
    expect(appreciation(18.99)).toBe('Excellent');
    expect(appreciation(19)).toBe('Exceptionnel');
    expect(appreciation(20)).toBe('Exceptionnel');
  });
  it('hors barème → throw', () => {
    expect(() => appreciation(-1)).toThrow();
    expect(() => appreciation(21)).toThrow();
  });
});

describe('classement', () => {
  it('ordre décroissant, dense ranking', () => {
    const r = classement([
      { id: 'a', moyenne: 12 },
      { id: 'b', moyenne: 15 },
      { id: 'c', moyenne: 10 },
    ]);
    const byId = Object.fromEntries(r.map((e) => [e.id, e.rang]));
    expect(byId).toEqual({ b: 1, a: 2, c: 3 });
  });
  it('gestion des égalités (dense: pas de saut)', () => {
    const r = classement([
      { id: 'a', moyenne: 12 },
      { id: 'b', moyenne: 12 },
      { id: 'c', moyenne: 10 },
    ]);
    const byId = Object.fromEntries(r.map((e) => [e.id, e.rang]));
    expect(byId).toEqual({ a: 1, b: 1, c: 2 });
  });
  it('nulls → rang null, préservés dans le résultat', () => {
    const r = classement([
      { id: 'a', moyenne: 12 },
      { id: 'b', moyenne: null },
      { id: 'c', moyenne: 10 },
    ]);
    const byId = Object.fromEntries(r.map((e) => [e.id, e.rang]));
    expect(byId).toEqual({ a: 1, c: 2, b: null });
  });
  it('liste vide', () => {
    expect(classement([])).toEqual([]);
  });
});

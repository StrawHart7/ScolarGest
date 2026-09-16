import { describe, it, expect } from 'vitest';
import { comparerClasses, trierClasses, type ClasseTriable } from '../tri-classes';

/** Rangs réels du catalogue : collège vaut 3, lycée 4 (migration `0001`). */
const COLLEGE = 3;
const LYCEE = 4;

function classe(nom: string, cycleOrdre: number | null, niveauOrdre: number | null): ClasseTriable {
  return { nom, niveau: { ordre: niveauOrdre, cycle: { ordre: cycleOrdre } } };
}

// Un complexe collège-lycée complet, saisi dans le désordre.
const SIXIEME_A = classe('6ème A', COLLEGE, 1);
const SIXIEME_B = classe('6ème B', COLLEGE, 1);
const CINQUIEME = classe('5ème', COLLEGE, 2);
const QUATRIEME = classe('4ème', COLLEGE, 3);
const TROISIEME = classe('3ème', COLLEGE, 4);
const SECONDE = classe('2nde A4', LYCEE, 1);
const PREMIERE = classe('1ère D', LYCEE, 2);
const TERMINALE = classe('Tle D', LYCEE, 3);

describe('trierClasses', () => {
  it('range de la 6ème à la Terminale, et non par ordre alphabétique', () => {
    // L'oracle est écrit à la main : c'est l'ordre dans lequel un directeur
    // togolais énumère ses classes. Le tri par nom donnait
    // « 1ère, 2nde, 3ème, 4ème, 5ème, 6ème, Tle » — l'ordre du dictionnaire.
    const desordre = [TERMINALE, TROISIEME, PREMIERE, SIXIEME_A, SECONDE, CINQUIEME, QUATRIEME];
    expect(trierClasses(desordre).map((c) => c.nom)).toEqual([
      '6ème A',
      '5ème',
      '4ème',
      '3ème',
      '2nde A4',
      '1ère D',
      'Tle D',
    ]);
  });

  it('met tout le collège avant tout le lycée', () => {
    // Le rang du cycle prime sur celui du niveau : la 3ème est le quatrième
    // niveau de son cycle, la 2nde le premier du sien, et pourtant la 3ème
    // passe devant.
    expect(comparerClasses(TROISIEME, SECONDE)).toBeLessThan(0);
  });

  it('départage les divisions d’un même niveau par leur nom', () => {
    expect(comparerClasses(SIXIEME_A, SIXIEME_B)).toBeLessThan(0);
  });

  it('range Tle D10 après Tle D2, et non entre D1 et D2', () => {
    // Comparaison numérique. Dix divisions n'est pas une hypothèse d'école :
    // c'est le cas ordinaire d'un grand lycée de Lomé.
    const divisions = ['Tle D10', 'Tle D2', 'Tle D1'].map((n) => classe(n, LYCEE, 3));
    expect(trierClasses(divisions).map((c) => c.nom)).toEqual(['Tle D1', 'Tle D2', 'Tle D10']);
  });

  it('relègue en fin de liste une classe dont le rang est inconnu', () => {
    // Ce cas ne se produit que si l'appelant a oublié d'embarquer
    // `niveau(ordre, cycle(ordre))`. La mettre en tête ferait passer un défaut
    // de requête pour une décision.
    const orpheline: ClasseTriable = { nom: 'Classe sans niveau' };
    expect(trierClasses([orpheline, TERMINALE, SIXIEME_A]).map((c) => c.nom)).toEqual([
      '6ème A',
      'Tle D',
      'Classe sans niveau',
    ]);
  });

  it('ne modifie pas le tableau reçu', () => {
    // Les appelants passent le retour d'une requête, parfois mémoïsé.
    const source = [TERMINALE, SIXIEME_A];
    trierClasses(source);
    expect(source.map((c) => c.nom)).toEqual(['Tle D', '6ème A']);
  });
});

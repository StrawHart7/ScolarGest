import { describe, it, expect } from 'vitest';
import { construireSerie } from '../series-ecole';

/**
 * `construireSerie` est la seule logique non triviale du module — le reste
 * n'est qu'une requete. On la teste sans base, avec une date de fin fixe :
 * une serie « des douze derniers mois » calculee sur `new Date()` changerait
 * de resultat selon le jour ou le test tourne.
 */

/** 15 juin 2026, midi UTC — au milieu du mois, pour ne pas frôler les bords. */
const FIN = new Date('2026-06-15T12:00:00Z');

describe('construireSerie', () => {
  it('rend exactement le nombre de mois demande, du plus ancien au plus recent', () => {
    const serie = construireSerie([], 6, FIN);
    expect(serie.map((p) => p.mois)).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
    ]);
  });

  it('remplit les mois sans donnee a zero plutot que de les omettre', () => {
    // Un creux est une information. Omettre le mois ferait relier avril a juin
    // en ligne droite, effacant un mai a zero.
    const serie = construireSerie(
      [
        { date: '2026-04-03T08:00:00Z', valeur: 5000 },
        { date: '2026-06-01T08:00:00Z', valeur: 2000 },
      ],
      6,
      FIN,
    );
    expect(serie).toEqual([
      { mois: '2026-01', valeur: 0 },
      { mois: '2026-02', valeur: 0 },
      { mois: '2026-03', valeur: 0 },
      { mois: '2026-04', valeur: 5000 },
      { mois: '2026-05', valeur: 0 },
      { mois: '2026-06', valeur: 2000 },
    ]);
  });

  it('additionne plusieurs lignes tombant dans le meme mois', () => {
    const serie = construireSerie(
      [
        { date: '2026-06-02T08:00:00Z', valeur: 1500 },
        { date: '2026-06-20T19:00:00Z', valeur: 500 },
        { date: '2026-06-30T23:00:00Z', valeur: 250 },
      ],
      3,
      FIN,
    );
    expect(serie.at(-1)).toEqual({ mois: '2026-06', valeur: 2250 });
  });

  it('ignore une ligne anterieure a la fenetre au lieu de la rattacher au premier mois', () => {
    // La borne SQL peut laisser passer un decalage de fuseau. Rattacher la
    // ligne au premier mois creerait un pic artificiel en debut de courbe.
    const serie = construireSerie(
      [
        { date: '2025-11-30T23:30:00Z', valeur: 99999 },
        { date: '2026-05-10T08:00:00Z', valeur: 100 },
      ],
      3,
      FIN,
    );
    expect(serie).toEqual([
      { mois: '2026-04', valeur: 0 },
      { mois: '2026-05', valeur: 100 },
      { mois: '2026-06', valeur: 0 },
    ]);
  });

  it('traverse un changement d annee sans trou ni doublon', () => {
    const serie = construireSerie([], 4, new Date('2026-02-10T12:00:00Z'));
    expect(serie.map((p) => p.mois)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });
});

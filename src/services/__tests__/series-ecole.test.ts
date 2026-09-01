import { describe, it, expect } from 'vitest';
import { construireSerie, moisDeLAnnee } from '../series-ecole';

/**
 * Les deux fonctions pures du module. Le reste n'est qu'une requete.
 */

describe('moisDeLAnnee', () => {
  it('couvre une annee scolaire de septembre a juillet, bornes incluses', () => {
    expect(moisDeLAnnee('2025-09-01', '2026-07-31')).toEqual([
      '2025-09', '2025-10', '2025-11', '2025-12', '2026-01',
      '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07',
    ]);
  });

  it('rend un seul mois quand debut et fin tombent dans le meme', () => {
    expect(moisDeLAnnee('2026-03-02', '2026-03-28')).toEqual(['2026-03']);
  });

  it('borne une annee mal saisie au lieu de boucler sans fin', () => {
    // Une date de fin aberrante ne doit produire ni boucle infinie ni serie de
    // plusieurs centaines de colonnes.
    expect(moisDeLAnnee('2020-01-01', '2099-12-31')).toHaveLength(24);
  });

  it('rend une serie vide si la fin precede le debut', () => {
    expect(moisDeLAnnee('2026-07-31', '2025-09-01')).toEqual([]);
  });
});

describe('construireSerie', () => {
  const ANNEE = moisDeLAnnee('2025-09-01', '2026-07-31');

  it('remplit les mois sans donnee a zero plutot que de les omettre', () => {
    // Un creux est une information. Omettre le mois ferait relier septembre a
    // novembre en ligne droite, effacant un octobre a zero.
    const serie = construireSerie(
      [
        { date: '2025-09-12T08:00:00Z', valeur: 5000 },
        { date: '2025-11-03T08:00:00Z', valeur: 2000 },
      ],
      ANNEE,
    );
    expect(serie.slice(0, 3)).toEqual([
      { mois: '2025-09', valeur: 5000 },
      { mois: '2025-10', valeur: 0 },
      { mois: '2025-11', valeur: 2000 },
    ]);
    expect(serie).toHaveLength(ANNEE.length);
  });

  it('additionne plusieurs lignes tombant dans le meme mois', () => {
    const serie = construireSerie(
      [
        { date: '2026-01-02T08:00:00Z', valeur: 1500 },
        { date: '2026-01-20T19:00:00Z', valeur: 500 },
        { date: '2026-01-31T23:00:00Z', valeur: 250 },
      ],
      ANNEE,
    );
    expect(serie.find((p) => p.mois === '2026-01')).toEqual({ mois: '2026-01', valeur: 2250 });
  });

  it('ignore une ligne hors annee au lieu de la rattacher au premier mois', () => {
    // La borne SQL peut laisser passer un decalage de fuseau. La rattacher
    // creerait un pic artificiel en debut de courbe.
    const serie = construireSerie(
      [
        { date: '2025-08-31T23:30:00Z', valeur: 99999 },
        { date: '2026-05-10T08:00:00Z', valeur: 100 },
      ],
      ANNEE,
    );
    expect(serie[0]).toEqual({ mois: '2025-09', valeur: 0 });
    expect(serie.find((p) => p.mois === '2026-05')).toEqual({ mois: '2026-05', valeur: 100 });
  });

  it('rend une serie vide sans mois', () => {
    expect(construireSerie([{ date: '2026-01-01', valeur: 1 }], [])).toEqual([]);
  });
});

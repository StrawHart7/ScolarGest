import { describe, it, expect } from 'vitest';
import {
  lireParametresListe,
  normaliser,
  paginer,
  preparerListe,
  rechercher,
  trier,
  TAILLE_PAGE_DEFAUT,
} from '../liste';

interface Eleve {
  nom: string;
  classe: string;
  moyenne: number | null;
}

const eleves: Eleve[] = [
  { nom: 'KODJO Ama', classe: '6ème A', moyenne: 12 },
  { nom: 'Élève Test', classe: '6ème B', moyenne: null },
  { nom: 'ADJO Kossi', classe: 'Tle D', moyenne: 15.5 },
  { nom: 'MENSAH Afi', classe: '6ème A', moyenne: 9 },
];

describe('normaliser', () => {
  it('retire les diacritiques et la casse', () => {
    expect(normaliser('Élève')).toBe('eleve');
    expect(normaliser('  KODJO  ')).toBe('kodjo');
  });

  it('rend une chaîne vide pour null et undefined', () => {
    expect(normaliser(null)).toBe('');
    expect(normaliser(undefined)).toBe('');
  });
});

describe('rechercher', () => {
  const champs = (e: Eleve) => [e.nom, e.classe];

  it('retourne tout quand le terme est vide', () => {
    expect(rechercher(eleves, '   ', champs)).toHaveLength(4);
  });

  it('ignore les accents et la casse', () => {
    expect(rechercher(eleves, 'eleve', champs).map((e) => e.nom)).toEqual(['Élève Test']);
  });

  it('exige que tous les mots soient présents', () => {
    expect(rechercher(eleves, 'kodjo 6eme', champs)).toHaveLength(1);
    expect(rechercher(eleves, 'kodjo tle', champs)).toHaveLength(0);
  });
});

describe('trier', () => {
  it('trie en croissant et en décroissant', () => {
    // Collation française : « É » se classe avec « E », donc entre A et K.
    expect(trier(eleves, 'asc', (e) => e.nom).map((e) => e.nom[0])).toEqual(['A', 'É', 'K', 'M']);
    expect(trier(eleves, 'desc', (e) => e.moyenne)[0]?.moyenne).toBe(15.5);
  });

  it('relègue les valeurs nulles en fin de liste quel que soit le sens', () => {
    expect(trier(eleves, 'asc', (e) => e.moyenne).at(-1)?.moyenne).toBeNull();
    expect(trier(eleves, 'desc', (e) => e.moyenne).at(-1)?.moyenne).toBeNull();
  });

  it('est stable à valeur égale', () => {
    const memes = [
      { nom: 'A', classe: 'X', moyenne: 10 },
      { nom: 'B', classe: 'X', moyenne: 10 },
      { nom: 'C', classe: 'X', moyenne: 10 },
    ];
    expect(trier(memes, 'desc', (e) => e.moyenne).map((e) => e.nom)).toEqual(['A', 'B', 'C']);
  });
});

describe('paginer', () => {
  it('découpe et calcule les bornes affichées', () => {
    const p = paginer([1, 2, 3, 4, 5], 2, 2);
    expect(p.lignes).toEqual([3, 4]);
    expect(p.nombrePages).toBe(3);
    expect([p.debut, p.fin, p.total]).toEqual([3, 4, 5]);
  });

  it('ramène une page hors bornes dans les bornes', () => {
    expect(paginer([1, 2, 3], 99, 2).page).toBe(2);
    expect(paginer([1, 2, 3], -4, 2).page).toBe(1);
  });

  it('reste cohérent sur une liste vide', () => {
    const p = paginer([], 3, 10);
    expect([p.page, p.nombrePages, p.total, p.debut, p.fin]).toEqual([1, 1, 0, 0, 0]);
  });
});

describe('lireParametresListe', () => {
  it('applique les valeurs par défaut', () => {
    const p = lireParametresListe({});
    expect(p).toEqual({
      recherche: '',
      tri: undefined,
      sens: 'asc',
      page: 1,
      taillePage: TAILLE_PAGE_DEFAUT,
    });
  });

  it('lit les paramètres et ignore les valeurs invalides', () => {
    const p = lireParametresListe({ q: 'ama', tri: 'nom', sens: 'nimporte', page: 'abc' });
    expect(p.recherche).toBe('ama');
    expect(p.tri).toBe('nom');
    expect(p.sens).toBe('asc');
    expect(p.page).toBe(1);
  });

  it('accepte un tableau de valeurs (searchParams répétés)', () => {
    expect(lireParametresListe({ q: ['ama', 'kossi'] }).recherche).toBe('ama');
  });
});

describe('preparerListe', () => {
  it('filtre puis trie puis pagine, dans cet ordre', () => {
    const resultat = preparerListe(
      eleves,
      { recherche: '6eme', tri: 'moyenne', sens: 'desc', page: 1, taillePage: 2 },
      {
        champsRecherche: (e) => [e.nom, e.classe],
        valeursTri: { moyenne: (e) => e.moyenne },
      },
    );
    // 3 élèves en 6ème, triés par moyenne décroissante, null en dernier.
    expect(resultat.total).toBe(3);
    expect(resultat.lignes.map((e) => e.moyenne)).toEqual([12, 9]);
    expect(resultat.nombrePages).toBe(2);
  });
});

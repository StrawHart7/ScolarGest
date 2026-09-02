import { describe, it, expect } from 'vitest';
import { analyserEntetes, normaliserEntete, resumeEntetesPourSupport } from '../entetes';
import { cleIdentiteEleve, compter, aQuelqueChoseAEcrire, type LigneAnalysee } from '../analyse';

const ATTENDUES = ['nom', 'prenoms', 'date_naissance', 'classe'] as const;

describe('normaliserEntete', () => {
  it('retire les espaces de bord et met en minuscules', () => {
    expect(normaliserEntete('  Date_Naissance ')).toBe('date_naissance');
  });

  it("ne touche ni aux accents ni aux espaces internes : le gabarit reste strict", () => {
    expect(normaliserEntete('Date de naissance')).toBe('date de naissance');
  });
});

describe('analyserEntetes', () => {
  it('accepte un fichier conforme', () => {
    const a = analyserEntetes(['nom', 'prenoms', 'date_naissance', 'classe'], ATTENDUES);
    expect(a.conforme).toBe(true);
    expect(a.manquantes).toEqual([]);
  });

  it("accepte une casse differente : c'est la faute la plus frequente et la moins grave", () => {
    const a = analyserEntetes(['Nom', 'PRENOMS', ' date_naissance', 'Classe'], ATTENDUES);
    expect(a.conforme).toBe(true);
  });

  it("l'ordre des colonnes n'a pas d'importance", () => {
    const a = analyserEntetes(['classe', 'date_naissance', 'nom', 'prenoms'], ATTENDUES);
    expect(a.conforme).toBe(true);
  });

  it('signale precisement ce qui manque', () => {
    const a = analyserEntetes(['nom', 'prenoms'], ATTENDUES);
    expect(a.conforme).toBe(false);
    expect(a.manquantes).toEqual(['date_naissance', 'classe']);
  });

  it('signale les colonnes non reconnues sans bloquer pour autant', () => {
    const a = analyserEntetes(
      ['nom', 'prenoms', 'date_naissance', 'classe', 'redoublant'],
      ATTENDUES,
    );
    expect(a.conforme).toBe(true);
    expect(a.inattendues).toEqual(['redoublant']);
  });

  it('ignore les colonnes vides que produit un export Excel', () => {
    const a = analyserEntetes(['nom', '', 'prenoms', '  ', 'date_naissance', 'classe'], ATTENDUES);
    expect(a.conforme).toBe(true);
    expect(a.inattendues).toEqual([]);
  });

  it('un fichier sans en-tete du tout est non conforme, pas vide', () => {
    const a = analyserEntetes([], ATTENDUES);
    expect(a.conforme).toBe(false);
    expect(a.manquantes).toEqual([...ATTENDUES]);
  });
});

describe('resumeEntetesPourSupport', () => {
  it("nomme ce qui manque et ce qui a ete trouve, pour que le support agisse sans relancer", () => {
    const texte = resumeEntetesPourSupport(
      analyserEntetes(['Nom complet', 'Naissance'], ATTENDUES),
    );
    expect(texte).toContain('nom, prenoms, date_naissance, classe');
    expect(texte).toContain('Nom complet, Naissance');
  });
});

describe('cleIdentiteEleve', () => {
  it('ignore casse, espaces de bord et espaces multiples', () => {
    expect(cleIdentiteEleve('  KOFFI ', 'Ama   Grace', '2010-05-12')).toBe(
      cleIdentiteEleve('Koffi', 'ama grace', '2010-05-12'),
    );
  });

  it("tolere une date horodatee : la base rend un timestamptz", () => {
    expect(cleIdentiteEleve('Koffi', 'Ama', '2010-05-12T00:00:00.000Z')).toBe(
      cleIdentiteEleve('Koffi', 'Ama', '2010-05-12'),
    );
  });

  it('distingue deux eleves de meme nom nes a des dates differentes', () => {
    expect(cleIdentiteEleve('Koffi', 'Ama', '2010-05-12')).not.toBe(
      cleIdentiteEleve('Koffi', 'Ama', '2011-05-12'),
    );
  });
});

describe('compter', () => {
  const lignes: LigneAnalysee[] = [
    { ligne: 2, statut: 'PRETE', libelle: 'A', motif: '' },
    { ligne: 3, statut: 'DOUBLON', libelle: 'B', motif: 'Deja inscrit' },
    { ligne: 4, statut: 'DOUBLON', libelle: 'C', motif: 'Deja inscrit' },
    { ligne: 5, statut: 'REFUSEE', libelle: 'D', motif: 'Classe introuvable' },
  ];

  it('separe doublons et refus : un doublon n_appelle aucune action', () => {
    expect(compter(lignes)).toEqual({ pretes: 1, doublons: 2, refusees: 1 });
  });

  it("un fichier entierement redepose n'a aucun refus", () => {
    const redepose: LigneAnalysee[] = lignes
      .filter((l) => l.statut !== 'REFUSEE')
      .map((l) => ({ ...l, statut: 'DOUBLON' as const }));
    expect(compter(redepose).refusees).toBe(0);
    expect(aQuelqueChoseAEcrire(redepose)).toBe(false);
  });

  it('autorise la confirmation des lors qu_une seule ligne est prete', () => {
    expect(aQuelqueChoseAEcrire(lignes)).toBe(true);
  });
});

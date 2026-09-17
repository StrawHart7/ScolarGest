/**
 * Un classeur televerse est une donnee hostile jusqu'a preuve du contraire.
 *
 * Le paquet npm `xlsx` est fige en 0.18.5 et porte une pollution de prototype
 * connue (GHSA-4r6h-8v6p-xvw6), dont le chemin est le mode **objet** de
 * `sheet_to_json` : la bibliotheque y construit les lignes en prenant pour
 * cles les en-tetes du fichier. `lireClasseur` ne l'emprunte plus — il lit en
 * matrice et fabrique les objets lui-meme.
 *
 * Ces tests eprouvent la consequence, pas l'intention : ils montent de vrais
 * classeurs et regardent l'etat du prototype apres lecture.
 */
import { afterEach, describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { lireClasseur } from '../excel';

/** Fabrique un classeur reel a partir d'une matrice de cellules. */
function classeur(matrice: unknown[][]): Buffer {
  const feuille = XLSX.utils.aoa_to_sheet(matrice);
  const livre = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(livre, feuille, 'Feuille1');
  return XLSX.write(livre, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

/**
 * Premiere ligne de donnees, ou echec explicite.
 *
 * `noUncheckedIndexedAccess` rend `lignes[0]` possiblement absent, et une
 * assertion non nulle masquerait un vrai « le classeur n'a rien rendu » derriere
 * un plantage illisible.
 */
function premiere(lu: { lignes: { valeurs: Record<string, unknown> }[] }) {
  const ligne = lu.lignes[0];
  if (!ligne) throw new Error('Le classeur n a rendu aucune ligne de donnees');
  return ligne;
}

afterEach(() => {
  // Si un essai a pollue malgre tout, ne pas contaminer le reste de la suite.
  delete (Object.prototype as Record<string, unknown>).pollue;
});

describe('lireClasseur', () => {
  it('lit les en-tetes et les lignes, cles normalisees en minuscules', () => {
    const lu = lireClasseur(
      classeur([
        ['Nom', 'Prenoms'],
        ['Kodjo', 'Ama'],
      ]),
    );
    expect(lu.entetes).toEqual(['Nom', 'Prenoms']);
    expect(lu.lignes).toHaveLength(1);
    expect(premiere(lu).valeurs).toMatchObject({ nom: 'Kodjo', prenoms: 'Ama' });
  });

  /**
   * Le coeur du fichier. Une colonne nommee `__proto__` atteignait le
   * prototype de **tous** les objets du processus — donc les requetes des
   * autres ecoles servies par la meme instance.
   */
  it('ne laisse pas une colonne __proto__ atteindre le prototype', () => {
    const avant = (Object.prototype as Record<string, unknown>).pollue;
    expect(avant).toBeUndefined();

    lireClasseur(
      classeur([
        ['Nom', '__proto__'],
        ['Kodjo', '{"pollue":"oui"}'],
      ]),
    );

    expect(({} as Record<string, unknown>).pollue).toBeUndefined();
    expect((Object.prototype as Record<string, unknown>).pollue).toBeUndefined();
  });

  it('ignore les colonnes au nom dangereux plutot que de les reporter', () => {
    const lu = lireClasseur(
      classeur([
        ['nom', '__proto__', 'constructor', 'prototype'],
        ['Kodjo', 'x', 'y', 'z'],
      ]),
    );
    const cles = Object.keys(premiere(lu).valeurs);
    expect(cles).toEqual(['nom']);
  });

  it('garde un objet ordinaire, utilisable par les schemas Zod', () => {
    const lu = lireClasseur(
      classeur([
        ['nom'],
        ['Kodjo'],
      ]),
    );
    // Le prototype doit rester celui d'un objet normal : un objet sans
    // prototype casserait des appels aussi anodins que `hasOwnProperty`.
    expect(Object.getPrototypeOf(premiere(lu).valeurs)).toBe(Object.prototype);
  });

  /**
   * Le mode objet sautait les lignes vides, et le numero annonce valait
   * `index + 2`. Une seule ligne blanche decalait donc tout le rapport
   * d'import : « erreur ligne 34 » designait la 35, et l'ecole corrigeait la
   * mauvaise.
   */
  it('numerote les lignes d apres la feuille, malgre une ligne blanche', () => {
    const lu = lireClasseur(
      classeur([
        ['nom'],
        ['Kodjo'],
        ['', ''],
        ['Afi'],
      ]),
    );
    expect(lu.lignes.map((l) => [l.ligne, l.valeurs.nom])).toEqual([
      [2, 'Kodjo'],
      [4, 'Afi'],
    ]);
  });

  it('rend un classeur vide sans lever', () => {
    const livre = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(livre, XLSX.utils.aoa_to_sheet([[]]), 'Vide');
    const vide = XLSX.write(livre, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    expect(lireClasseur(vide)).toEqual({ entetes: [], lignes: [] });
  });
});

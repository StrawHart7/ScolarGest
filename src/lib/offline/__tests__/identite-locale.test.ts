import { beforeEach, describe, expect, it, vi } from 'vitest';
import { lireIdentite, memoriserIdentite, oublierIdentite } from '../identite-locale';

/**
 * `environment: 'node'` : pas de `localStorage`. On en pose un, ce qui permet
 * aussi de simuler celui qui refuse — navigation privee stricte, quota plein.
 */
function poserStockage(impl?: Partial<Storage>) {
  const donnees = new Map<string, string>();
  const base: Partial<Storage> = {
    getItem: (c: string) => donnees.get(c) ?? null,
    setItem: (c: string, v: string) => void donnees.set(c, v),
    removeItem: (c: string) => void donnees.delete(c),
  };
  vi.stubGlobal('localStorage', { ...base, ...impl });
  return donnees;
}

const IDENTITE = { userId: 'u-1', etablissementId: 'e-1' };

describe('identite locale', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('relit ce qui a été mémorisé', () => {
    poserStockage();
    memoriserIdentite(IDENTITE);
    expect(lireIdentite()).toEqual(IDENTITE);
  });

  it('rend `null` quand rien n’a été mémorisé', () => {
    poserStockage();
    expect(lireIdentite()).toBeNull();
  });

  it('oublie à la demande — c’est ce qui referme le cas du poste partagé', () => {
    poserStockage();
    memoriserIdentite(IDENTITE);
    oublierIdentite();
    expect(lireIdentite()).toBeNull();
  });

  it('ignore une valeur corrompue au lieu de lever', () => {
    // Elle est relue depuis une page d'erreur : y lever remplacerait un
    // message par un ecran blanc, exactement ce qu'on cherche a eviter.
    const donnees = poserStockage();
    donnees.set('scolargest.identite', '{ pas du json');
    expect(lireIdentite()).toBeNull();
  });

  it('ignore une identité incomplète', () => {
    const donnees = poserStockage();
    donnees.set('scolargest.identite', JSON.stringify({ userId: 'u-1' }));
    expect(lireIdentite()).toBeNull();
  });

  it('ne lève pas quand le stockage refuse', () => {
    poserStockage({
      setItem: () => {
        throw new Error('quota');
      },
      getItem: () => {
        throw new Error('bloqué');
      },
    });
    expect(() => memoriserIdentite(IDENTITE)).not.toThrow();
    expect(lireIdentite()).toBeNull();
  });

  it('ne lève pas sans `localStorage` du tout', () => {
    expect(() => memoriserIdentite(IDENTITE)).not.toThrow();
    expect(lireIdentite()).toBeNull();
    expect(() => oublierIdentite()).not.toThrow();
  });
});

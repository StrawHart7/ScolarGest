import { describe, expect, it } from 'vitest';
import {
  estTypeOperation,
  messageErreur,
  nouvelleCleOperation,
  TYPES_OPERATION,
} from '../operations';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('nouvelleCleOperation', () => {
  it('produit un UUID v4 accepté par la colonne `uuid`', () => {
    // Une chaîne libre serait refusée à l'insertion, et l'écriture différée
    // échouerait au moment précis où l'utilisateur n'a pas de réseau pour
    // comprendre pourquoi.
    for (let i = 0; i < 200; i += 1) {
      expect(nouvelleCleOperation()).toMatch(UUID_V4);
    }
  });

  it('ne se répète pas', () => {
    const vues = new Set(Array.from({ length: 1000 }, () => nouvelleCleOperation()));
    expect(vues.size).toBe(1000);
  });
});

describe('estTypeOperation', () => {
  it('accepte les types connus et refuse le reste', () => {
    for (const type of TYPES_OPERATION) expect(estTypeOperation(type)).toBe(true);
    expect(estTypeOperation('VIREMENT_LIBRE')).toBe(false);
    expect(estTypeOperation('')).toBe(false);
    expect(estTypeOperation(null)).toBe(false);
  });
});

describe('messageErreur', () => {
  it('lit une erreur Supabase, qui n’est pas une Error', () => {
    expect(messageErreur({ message: 'doublon', details: 'cle (a,b)' })).toBe('doublon — cle (a,b)');
    expect(messageErreur({ code: '23505' })).toBe('Code 23505');
    expect(messageErreur(new Error('classique'))).toBe('classique');
    expect(messageErreur(undefined)).toBe('Erreur inconnue');
  });
});

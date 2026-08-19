import { describe, it, expect } from 'vitest';
import { enseignantImportLigneSchema } from '../enseignant-import-schema';

const validLigne = {
  nom: 'Amegan',
  prenoms: 'Koffi',
  sexe: 'M',
  email: 'koffi.amegan@example.com',
  telephone: '90000000',
  date_naissance: '1985-04-12',
  date_embauche: '2020-09-01',
  matricule_ancien: '',
  classe: '6e A',
  matiere: 'Mathématiques',
};

describe('enseignantImportLigneSchema', () => {
  it('accepte une ligne valide', () => {
    const result = enseignantImportLigneSchema.parse(validLigne);
    expect(result.email).toBe('koffi.amegan@example.com');
  });

  it('accepte une ligne valide sans champs optionnels', () => {
    const rest = {
      nom: validLigne.nom,
      prenoms: validLigne.prenoms,
      sexe: validLigne.sexe,
      email: validLigne.email,
      classe: validLigne.classe,
      matiere: validLigne.matiere,
    };
    const result = enseignantImportLigneSchema.safeParse(rest);
    expect(result.success).toBe(true);
  });

  it('rejette un email manquant', () => {
    const result = enseignantImportLigneSchema.safeParse({ ...validLigne, email: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'email')).toBe(true);
    }
  });

  it('rejette un sexe invalide', () => {
    const result = enseignantImportLigneSchema.safeParse({ ...validLigne, sexe: 'X' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'sexe')).toBe(true);
    }
  });

  it('rejette une classe manquante', () => {
    const result = enseignantImportLigneSchema.safeParse({ ...validLigne, classe: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'classe')).toBe(true);
    }
  });

  it('rejette une matière manquante', () => {
    const result = enseignantImportLigneSchema.safeParse({ ...validLigne, matiere: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'matiere')).toBe(true);
    }
  });
});

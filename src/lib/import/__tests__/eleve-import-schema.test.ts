import { describe, it, expect } from 'vitest';
import { eleveImportLigneSchema } from '../eleve-import-schema';

const validLigne = {
  nom: 'Kouassi',
  prenoms: 'Awa',
  sexe: 'F',
  date_naissance: '2012-03-15',
  lieu_naissance: 'Lomé',
  nationalite: 'Togolaise',
  ancien_matricule: '',
  classe: '6e A',
  nom_responsable: 'Kouassi',
  prenoms_responsable: 'Jean',
  telephone_responsable: '90000000',
  email_responsable: 'jean@example.com',
  type_responsable: 'PERE',
  lien_parente: 'Père',
  principal: 'OUI',
};

describe('eleveImportLigneSchema', () => {
  it('accepte une ligne valide et transforme principal OUI/NON en booléen', () => {
    const result = eleveImportLigneSchema.parse(validLigne);
    expect(result.principal).toBe(true);
  });

  it('rejette un sexe invalide', () => {
    const result = eleveImportLigneSchema.safeParse({ ...validLigne, sexe: 'X' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'sexe')).toBe(true);
    }
  });

  it('rejette une date de naissance invalide', () => {
    const result = eleveImportLigneSchema.safeParse({ ...validLigne, date_naissance: '15/03/2012' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'date_naissance')).toBe(true);
    }
  });

  it('rejette une classe manquante', () => {
    const result = eleveImportLigneSchema.safeParse({ ...validLigne, classe: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'classe')).toBe(true);
    }
  });
});

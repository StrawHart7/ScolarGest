import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetTenantContext = vi.fn();
vi.mock('../tenant', () => ({
  getTenantContext: () => mockGetTenantContext(),
}));
vi.mock('../audit', () => ({ auditLog: vi.fn(async () => undefined) }));

const mockCreateEleveAvecResponsables = vi.fn();
vi.mock('../eleve', () => ({
  createEleveAvecResponsables: (...args: unknown[]) => mockCreateEleveAvecResponsables(...args),
}));

const mockCreerInscriptionAvecFacture = vi.fn();
vi.mock('../inscription', () => ({
  creerInscriptionAvecFacture: (...args: unknown[]) => mockCreerInscriptionAvecFacture(...args),
}));

const mockClasseSelect = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: async () => mockClasseSelect(),
        }),
      }),
    }),
  }),
}));

import { importerLignesValides } from '../import-eleves';
import type { EleveImportLigne } from '@/lib/import/eleve-import-schema';

function ligne(overrides: Partial<EleveImportLigne> = {}): { ligne: number; data: EleveImportLigne } {
  return {
    ligne: 2,
    data: {
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
      principal: true,
      ...overrides,
    },
  };
}

describe('importerLignesValides', () => {
  beforeEach(() => {
    mockGetTenantContext.mockResolvedValue({
      userId: 'u1',
      etablissementId: 'etab1',
      role: 'SECRETAIRE',
      email: 'a@a.com',
    });
    mockClasseSelect.mockReturnValue({ data: [{ id: 'classe1', nom: '6e A' }], error: null });
    mockCreateEleveAvecResponsables.mockReset();
    mockCreerInscriptionAvecFacture.mockReset();
  });

  it('une ligne invalide (classe introuvable) n\'empêche pas les autres lignes valides', async () => {
    mockCreateEleveAvecResponsables.mockResolvedValue('eleve1');
    mockCreerInscriptionAvecFacture.mockResolvedValue({ inscriptionId: 'i1', factureId: 'f1' });

    const lignes = [ligne(), ligne({ classe: 'Classe inexistante' })];
    const rapport = await importerLignesValides(lignes, 'annee1');

    expect(rapport.totalLignes).toBe(2);
    expect(rapport.succes).toBe(1);
    expect(rapport.echecs).toBe(1);
    expect(rapport.details[1]?.ok).toBe(false);
    expect(rapport.details[1]?.message).toMatch(/introuvable/);
  });

  it('produit un rapport détaillé par ligne y compris en cas d\'échec de création', async () => {
    mockCreateEleveAvecResponsables
      .mockResolvedValueOnce('eleve1')
      .mockRejectedValueOnce(new Error('Erreur RPC simulée'));
    mockCreerInscriptionAvecFacture.mockResolvedValue({ inscriptionId: 'i1', factureId: 'f1' });

    const lignes = [ligne(), ligne({ nom: 'Autre' })];
    const rapport = await importerLignesValides(lignes, 'annee1');

    expect(rapport.details).toHaveLength(2);
    expect(rapport.details[0]).toMatchObject({ ok: true, eleveId: 'eleve1' });
    expect(rapport.details[1]).toMatchObject({ ok: false, message: 'Erreur RPC simulée' });
  });
});

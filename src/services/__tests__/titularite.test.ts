import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetTenantContext = vi.fn();
vi.mock('../tenant', () => ({
  getTenantContext: () => mockGetTenantContext(),
}));
vi.mock('../audit', () => ({ auditLog: vi.fn(async () => undefined) }));

const mockUpsert = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    from: (table: string) => mockFrom(table),
  }),
}));

import { definirTitulaire } from '../titularite';

describe('definirTitulaire', () => {
  beforeEach(() => {
    mockGetTenantContext.mockResolvedValue({
      userId: 'u1',
      etablissementId: 'etab1',
      role: 'DIRECTEUR',
      email: 'a@a.com',
    });
    mockUpsert.mockReset();
    mockFrom.mockReset();
    mockFrom.mockReturnValue({
      upsert: (...args: unknown[]) => mockUpsert(...args),
    });
  });

  it('upsert sur la contrainte unique classeId — remplace le titulaire existant sans doublon', async () => {
    mockUpsert.mockResolvedValue({ data: null, error: null });

    await definirTitulaire('classe1', 'annee1', 'ens2');

    expect(mockUpsert).toHaveBeenCalledWith(
      { classeId: 'classe1', anneeScolaireId: 'annee1', enseignantId: 'ens2' },
      { onConflict: 'classeId' },
    );
  });

  it('propage une erreur Supabase', async () => {
    mockUpsert.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(definirTitulaire('classe1', 'annee1', 'ens2')).rejects.toMatchObject({
      message: 'boom',
    });
  });
});

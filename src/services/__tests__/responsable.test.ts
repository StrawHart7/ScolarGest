import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetTenantContext = vi.fn();
vi.mock('../tenant', () => ({
  getTenantContext: () => mockGetTenantContext(),
}));
vi.mock('../audit', () => ({ auditLog: vi.fn(async () => undefined) }));

const mockRpc = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    rpc: (...args: unknown[]) => mockRpc(...args),
  }),
}));

import { linkResponsableEleve } from '../responsable';

describe('linkResponsableEleve', () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockGetTenantContext.mockResolvedValue({
      userId: 'u1',
      etablissementId: 'etab1',
      role: 'SECRETAIRE',
      email: 'a@a.com',
    });
  });

  it('délègue à la RPC fn_lier_responsable_eleve qui garantit un seul principal=true', async () => {
    mockRpc.mockResolvedValue({ data: 'resp2', error: null });
    const id = await linkResponsableEleve('eleve1', {
      nom: 'Doe',
      prenoms: 'Jane',
      type: 'MERE',
      lienParente: 'Mère',
      principal: true,
    });
    expect(id).toBe('resp2');
    expect(mockRpc).toHaveBeenCalledWith(
      'fn_lier_responsable_eleve',
      expect.objectContaining({
        p_eleve_id: 'eleve1',
        p_responsable: expect.objectContaining({ principal: true }),
      }),
    );
  });

  it('propage une erreur RPC en Error JS lisible', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(
      linkResponsableEleve('eleve1', { lienParente: 'Tuteur', type: 'TUTEUR' }),
    ).rejects.toThrow('boom');
  });
});

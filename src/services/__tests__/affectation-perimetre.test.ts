import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetTenantContext = vi.fn();
vi.mock('../tenant', () => ({
  getTenantContext: () => mockGetTenantContext(),
}));

const mockGetEnseignantParUtilisateur = vi.fn();
vi.mock('../enseignant', () => ({
  getEnseignantParUtilisateur: (utilisateurId: string) => mockGetEnseignantParUtilisateur(utilisateurId),
}));

vi.mock('../audit', () => ({ auditLog: vi.fn(async () => undefined) }));

function makeChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = vi.fn(self);
  chain.eq = vi.fn(self);
  chain.insert = vi.fn(self);
  chain.delete = vi.fn(self);
  chain.single = vi.fn(async () => result);
  chain.maybeSingle = vi.fn(async () => result);
  // listAffectationsEnseignant resolves the query itself (no terminal call) —
  // supabase-js query builders are thenable, so awaiting the chain directly
  // must also resolve to `result`.
  (chain as unknown as { then: unknown }).then = (
    resolve: (v: { data: unknown; error: unknown }) => void,
  ) => resolve(result);
  return chain;
}

let affectationResult: { data: unknown; error: unknown };
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    from: (table: string) => mockFrom(table),
  }),
}));

import { listAffectationsEnseignant } from '../affectation';

describe('listAffectationsEnseignant — périmètre d’accès enseignant', () => {
  beforeEach(() => {
    mockFrom.mockReset();
    mockGetEnseignantParUtilisateur.mockReset();
    affectationResult = { data: [{ id: 'aff1' }], error: null };
    mockFrom.mockImplementation((table: string) => {
      if (table === 'affectation_enseignant') return makeChain(affectationResult);
      throw new Error(`unexpected table ${table}`);
    });
    mockGetTenantContext.mockResolvedValue({
      userId: 'user-self',
      etablissementId: 'etab1',
      role: 'ENSEIGNANT',
      email: 'prof@ecole.tg',
    });
  });

  it("autorise un enseignant à consulter ses propres affectations et interroge Supabase", async () => {
    mockGetEnseignantParUtilisateur.mockResolvedValue({ id: 'ens-self', nom: 'Doe' });

    const result = await listAffectationsEnseignant('ens-self', 'annee1');

    expect(result).toEqual([{ id: 'aff1' }]);
    expect(mockGetEnseignantParUtilisateur).toHaveBeenCalledWith('user-self');
    expect(mockFrom).toHaveBeenCalledWith('affectation_enseignant');
  });

  it('refuse un enseignant qui tente de consulter les affectations d’un autre enseignant, sans jamais interroger Supabase', async () => {
    mockGetEnseignantParUtilisateur.mockResolvedValue({ id: 'ens-self', nom: 'Doe' });

    await expect(listAffectationsEnseignant('ens-other', 'annee1')).rejects.toThrow('Accès refusé');

    expect(mockFrom).not.toHaveBeenCalled();
  });
});

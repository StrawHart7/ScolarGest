import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetTenantContext = vi.fn();
vi.mock('../tenant', () => ({
  getTenantContext: () => mockGetTenantContext(),
}));
vi.mock('../audit', () => ({ auditLog: vi.fn(async () => undefined) }));
vi.mock('../enseignant', () => ({
  getEnseignantParUtilisateur: vi.fn(async () => null),
}));

function makeChain(result: { data: unknown; error: unknown; count?: number }) {
  const chain: Record<string, unknown> = {};
  const methods = ['select', 'eq', 'insert', 'update', 'delete', 'order', 'in', 'neq'];
  for (const m of methods) {
    chain[m] = vi.fn(() => chain);
  }
  chain.maybeSingle = vi.fn(async () => result);
  chain.single = vi.fn(async () => result);
  chain.then = (resolve: (v: unknown) => unknown) => resolve(result);
  return chain;
}

const mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    from: (table: string) => mockFrom(table),
  }),
}));

import { creerEvaluation } from '../evaluation';

describe('creerEvaluation', () => {
  beforeEach(() => {
    mockGetTenantContext.mockResolvedValue({
      userId: 'u1',
      etablissementId: 'etab1',
      role: 'DIRECTEUR',
      email: 'a@a.com',
    });
    mockFrom.mockReset();
  });

  it('refuse une 4e interrogation (numero > 3) avant même l\'insert', async () => {
    await expect(
      creerEvaluation({
        anneeScolaireId: 'annee1',
        classeId: 'classe1',
        matiereId: 'mat1',
        type: 'INTERROGATION',
        periode: 'TRIMESTRE_1',
        numero: 4,
        date: '2026-01-01',
      }),
    ).rejects.toThrow('3 interrogations');

    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('rejette un doublon (classe, matiere, type, periode, numero) via la contrainte unique DB', async () => {
    mockFrom.mockReturnValue(
      makeChain({ data: null, error: { code: '23505', message: 'duplicate key value' } }),
    );

    await expect(
      creerEvaluation({
        anneeScolaireId: 'annee1',
        classeId: 'classe1',
        matiereId: 'mat1',
        type: 'DEVOIR',
        periode: 'TRIMESTRE_1',
        numero: 1,
        date: '2026-01-01',
      }),
    ).rejects.toThrow('existe déjà');
  });

  it('crée une évaluation valide', async () => {
    mockFrom.mockReturnValue(makeChain({ data: { id: 'eval1' }, error: null }));

    const id = await creerEvaluation({
      anneeScolaireId: 'annee1',
      classeId: 'classe1',
      matiereId: 'mat1',
      type: 'INTERROGATION',
      periode: 'TRIMESTRE_1',
      numero: 2,
      date: '2026-01-01',
    });

    expect(id).toBe('eval1');
  });
});

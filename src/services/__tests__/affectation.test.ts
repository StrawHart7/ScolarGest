import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetTenantContext = vi.fn();
vi.mock('../tenant', () => ({
  getTenantContext: () => mockGetTenantContext(),
}));
vi.mock('../audit', () => ({ auditLog: vi.fn(async () => undefined) }));
vi.mock('../enseignant', () => ({
  getEnseignantParUtilisateur: vi.fn(async () => null),
}));

function makeInsertChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  chain.insert = vi.fn(() => chain);
  chain.select = vi.fn(() => chain);
  chain.single = vi.fn(async () => result);
  return chain;
}

let insertResult: { data: unknown; error: unknown };
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    from: (table: string) => mockFrom(table),
  }),
}));

import { creerAffectation } from '../affectation';

describe('creerAffectation', () => {
  beforeEach(() => {
    mockGetTenantContext.mockResolvedValue({
      userId: 'u1',
      etablissementId: 'etab1',
      role: 'DIRECTEUR',
      email: 'a@a.com',
    });
    mockFrom.mockReset();
  });

  it('crée une affectation enseignant×classe×matière', async () => {
    insertResult = { data: { id: 'aff1' }, error: null };
    mockFrom.mockReturnValue(makeInsertChain(insertResult));

    const id = await creerAffectation({
      anneeScolaireId: 'annee1',
      enseignantId: 'ens1',
      classeId: 'classe1',
      matiereId: 'mat1',
    });
    expect(id).toBe('aff1');
  });

  it('un même enseignant peut avoir plusieurs matières sur la même classe (deuxième appel réussit)', async () => {
    insertResult = { data: { id: 'aff2' }, error: null };
    mockFrom.mockReturnValue(makeInsertChain(insertResult));

    const id = await creerAffectation({
      anneeScolaireId: 'annee1',
      enseignantId: 'ens1',
      classeId: 'classe1',
      matiereId: 'mat2',
    });
    expect(id).toBe('aff2');
  });

  it('rejette une double affectation identique avec un message lisible (violation contrainte unique)', async () => {
    insertResult = { data: null, error: { code: '23505', message: 'duplicate key value' } };
    mockFrom.mockReturnValue(makeInsertChain(insertResult));

    await expect(
      creerAffectation({
        anneeScolaireId: 'annee1',
        enseignantId: 'ens1',
        classeId: 'classe1',
        matiereId: 'mat1',
      }),
    ).rejects.toThrow('déjà affecté');
  });

  it('propage une erreur inattendue telle quelle', async () => {
    insertResult = { data: null, error: { code: '42501', message: 'permission denied' } };
    mockFrom.mockReturnValue(makeInsertChain(insertResult));

    await expect(
      creerAffectation({
        anneeScolaireId: 'annee1',
        enseignantId: 'ens1',
        classeId: 'classe1',
        matiereId: 'mat1',
      }),
    ).rejects.toMatchObject({ message: 'permission denied' });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetTenantContext = vi.fn();
vi.mock('../tenant', () => ({
  getTenantContext: () => mockGetTenantContext(),
}));
vi.mock('../audit', () => ({ auditLog: vi.fn(async () => undefined) }));

// Chainable query builder mock: every call returns `this` except the
// terminal ones (single/maybeSingle) which resolve the configured result.
function makeChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  const methods = ['select', 'eq', 'is', 'insert', 'update'];
  for (const m of methods) {
    chain[m] = vi.fn(() => chain);
  }
  chain.maybeSingle = vi.fn(async () => result);
  chain.single = vi.fn(async () => result);
  return chain;
}

let getResult: { data: unknown; error: unknown };
let writeResult: { data: unknown; error: unknown };
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    from: (table: string) => mockFrom(table),
  }),
}));

import { definirCoefficient } from '../coefficient';

describe('definirCoefficient', () => {
  beforeEach(() => {
    mockGetTenantContext.mockResolvedValue({
      userId: 'u1',
      etablissementId: 'etab1',
      role: 'DIRECTEUR',
      email: 'a@a.com',
    });
    mockFrom.mockReset();
  });

  it('même année → update en place (pas de doublon)', async () => {
    getResult = {
      data: { id: 'coef1', programmeEtablissementId: 'p1', anneeScolaireId: 'annee1', serieId: null, coefficient: 2 },
      error: null,
    };
    writeResult = {
      data: { id: 'coef1', programmeEtablissementId: 'p1', anneeScolaireId: 'annee1', serieId: null, coefficient: 4 },
      error: null,
    };

    let call = 0;
    mockFrom.mockImplementation(() => {
      call += 1;
      return call === 1 ? makeChain(getResult) : makeChain(writeResult);
    });

    const result = await definirCoefficient('p1', 'annee1', null, 4);

    expect(result.coefficient).toBe(4);
    expect(result.id).toBe('coef1');
  });

  it('nouvelle année → nouvelle ligne (historisation, pas de modification du passé)', async () => {
    getResult = { data: null, error: null };
    writeResult = {
      data: { id: 'coef2', programmeEtablissementId: 'p1', anneeScolaireId: 'annee2', serieId: null, coefficient: 3 },
      error: null,
    };

    let call = 0;
    mockFrom.mockImplementation(() => {
      call += 1;
      return call === 1 ? makeChain(getResult) : makeChain(writeResult);
    });

    const result = await definirCoefficient('p1', 'annee2', null, 3);

    expect(result.id).toBe('coef2');
    expect(result.anneeScolaireId).toBe('annee2');
  });
});

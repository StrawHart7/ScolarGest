import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetTenantContext = vi.fn();
vi.mock('../tenant', () => ({
  getTenantContext: () => mockGetTenantContext(),
}));

function makeChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = vi.fn(self);
  chain.eq = vi.fn(self);
  chain.like = vi.fn(self);
  chain.order = vi.fn(self);
  chain.limit = vi.fn(self);
  chain.maybeSingle = vi.fn(async () => result);
  chain.single = vi.fn(async () => result);
  return chain;
}

let anneeResult: { data: unknown; error: unknown };
let eleveResult: { data: unknown; error: unknown };

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === 'annee_scolaire') return makeChain(anneeResult);
      if (table === 'eleve') return makeChain(eleveResult);
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

import { generateMatriculeEleve } from '../matricule';

describe('generateMatriculeEleve', () => {
  beforeEach(() => {
    mockGetTenantContext.mockResolvedValue({
      userId: 'u1',
      etablissementId: 'etab1',
      role: 'DIRECTEUR',
      email: 'a@a.com',
    });
    anneeResult = { data: { dateDebut: '2026-09-01T00:00:00Z' }, error: null };
  });

  it('génère un matricule avec un numéro de séquence sur 6 chiffres', async () => {
    eleveResult = { data: null, error: null };
    const matricule = await generateMatriculeEleve('annee1');
    expect(matricule).toBe('ELV-2026-000001');
  });

  it('incrémente à partir du dernier matricule existant', async () => {
    eleveResult = { data: { matricule: 'ELV-2026-000042' }, error: null };
    const matricule = await generateMatriculeEleve('annee1');
    expect(matricule).toBe('ELV-2026-000043');
  });

  it('pad toujours sur 6 chiffres même pour de grands nombres', async () => {
    eleveResult = { data: { matricule: 'ELV-2026-999999' }, error: null };
    const matricule = await generateMatriculeEleve('annee1');
    expect(matricule).toBe('ELV-2026-1000000');
    expect((matricule.split('-')[2] ?? '').length).toBeGreaterThanOrEqual(6);
  });
});

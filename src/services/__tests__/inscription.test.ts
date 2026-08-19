import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetTenantContext = vi.fn();
vi.mock('../tenant', () => ({
  getTenantContext: () => mockGetTenantContext(),
}));
vi.mock('../audit', () => ({ auditLog: vi.fn(async () => undefined) }));

const mockRpc = vi.fn();
const mockUpdate = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (table: string) => {
      const chain: Record<string, unknown> = {};
      chain.update = (payload: unknown) => {
        mockUpdate(table, payload);
        return chain;
      };
      chain.eq = vi.fn(() => chain);
      // Server Actions in the service don't await the builder further than
      // the last .eq() in our update path — emulate `await` by making the
      // object thenable, resolving to {error: null}.
      (chain as unknown as { then: unknown }).then = (resolve: (v: unknown) => void) =>
        resolve({ error: null });
      return chain;
    },
  }),
}));

import { creerInscriptionAvecFacture, annulerInscription, reinscrireEleve } from '../inscription';

describe('creerInscriptionAvecFacture', () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockGetTenantContext.mockResolvedValue({
      userId: 'u1',
      etablissementId: 'etab1',
      role: 'SECRETAIRE',
      email: 'a@a.com',
    });
  });

  it('retourne inscriptionId et factureId en cas de succès', async () => {
    mockRpc.mockResolvedValue({
      data: { inscriptionId: 'insc1', factureId: 'fact1' },
      error: null,
    });
    const result = await creerInscriptionAvecFacture({
      eleveId: 'e1',
      anneeScolaireId: 'a1',
      classeId: 'c1',
    });
    expect(result).toEqual({ inscriptionId: 'insc1', factureId: 'fact1' });
  });

  it('traduit la double inscription (même élève/année) en message métier lisible', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'Cet élève est déjà inscrit pour cette année scolaire.' },
    });
    await expect(
      creerInscriptionAvecFacture({ eleveId: 'e1', anneeScolaireId: 'a1', classeId: 'c1' }),
    ).rejects.toThrow('Cet élève est déjà inscrit pour cette année scolaire.');
  });
});

describe('annulerInscription / reinscrireEleve', () => {
  beforeEach(() => {
    mockUpdate.mockReset();
    mockGetTenantContext.mockResolvedValue({
      userId: 'u1',
      etablissementId: 'etab1',
      role: 'SECRETAIRE',
      email: 'a@a.com',
    });
  });

  it('annulation met à jour le statut sans supprimer la ligne', async () => {
    await annulerInscription('insc1');
    expect(mockUpdate).toHaveBeenCalledWith('inscription', { statut: 'ANNULEE' });
  });

  it('ré-inscription met à jour la ligne existante (update, pas insert)', async () => {
    await reinscrireEleve('insc1', 'c2');
    expect(mockUpdate).toHaveBeenCalledWith('inscription', {
      statut: 'ACTIVE',
      classeId: 'c2',
      decisionFinAnnee: null,
    });
  });
});

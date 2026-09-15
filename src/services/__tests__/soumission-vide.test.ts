import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Soumettre sans rien à soumettre n'est pas un succès.
 *
 * Panne constatée en preview le 2026-09-15. L'enseignant saisit ses notes,
 * clique « Soumettre » sans avoir cliqué « Enregistrer » : rien n'était parti
 * au serveur, `fn_soumettre_notes` ne trouvait aucune note en BROUILLON, son
 * `update` ne touchait aucune ligne — **ce qui n'est pas une erreur en
 * Postgres** — et renvoyait `0`. L'action rendait « succès », la fenêtre se
 * fermait sans un mot, et l'enseignant repartait convaincu d'avoir rendu ses
 * notes. Rien n'arrivait en approbation, donc le directeur ne voyait rien non
 * plus : les deux symptômes rapportés n'en faisaient qu'un.
 *
 * Le défaut de fond est corrigé côté écran, qui envoie désormais les lignes
 * avant de basculer. Ce test garde la **seconde barrière** : la même famille
 * de panne — un `update` qui ne touche rien et qu'on prend pour un succès — a
 * déjà été payée sur la RLS, et elle ne se voit jamais en production tant que
 * personne ne regarde le nombre de lignes.
 */

const mockGetTenantContext = vi.fn();
vi.mock('../tenant', () => ({ getTenantContext: () => mockGetTenantContext() }));

const { mockAuditLog } = vi.hoisted(() => ({
  mockAuditLog: vi.fn(async (..._args: unknown[]) => undefined),
}));
vi.mock('../audit', () => ({ auditLog: mockAuditLog }));
vi.mock('../enseignant', () => ({
  getEnseignantParUtilisateur: vi.fn(async () => ({ id: 'ens1' })),
}));
vi.mock('../pin', () => ({ verifyPin: async () => true, exigerPin: async () => undefined }));

function makeChain(result: { data?: unknown; error?: unknown; count?: number }) {
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'neq', 'insert', 'update', 'upsert', 'in', 'order', 'limit', 'gte']) {
    chain[m] = vi.fn(() => chain);
  }
  const valeur = { data: result.data ?? null, error: result.error ?? null, count: result.count };
  chain.maybeSingle = vi.fn(async () => valeur);
  chain.single = vi.fn(async () => valeur);
  chain.then = (resolve: (v: unknown) => unknown) => resolve(valeur);
  return chain;
}

const mockFrom = vi.fn();
const mockRpc = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    from: (table: string) => mockFrom(table),
    rpc: (...args: unknown[]) => mockRpc(...args),
  }),
}));

import { soumettreNotes } from '../note';

const EVALUATION = {
  id: 'eval1',
  anneeScolaireId: 'annee1',
  classeId: 'classe1',
  matiereId: 'mat1',
  type: 'DEVOIR',
  periode: 'TRIMESTRE_1',
  numero: 1,
};

describe('soumettreNotes', () => {
  beforeEach(() => {
    mockFrom.mockReset();
    mockRpc.mockReset();
    mockAuditLog.mockClear();
    mockGetTenantContext.mockResolvedValue({
      userId: 'u-ens',
      etablissementId: 'etab1',
      role: 'ENSEIGNANT',
      email: 'ens@ecole.tg',
    });
  });

  it('refuse une soumission qui ne bascule aucune note', async () => {
    mockFrom
      .mockImplementationOnce(() => makeChain({ data: EVALUATION })) // evaluation
      .mockImplementationOnce(() => makeChain({ count: 1 })); // affectation
    mockRpc.mockResolvedValue({ data: 0, error: null });

    await expect(soumettreNotes('eval1')).rejects.toThrow(/Aucune note à soumettre/);
    // Et surtout : rien n'est journalisé comme une soumission qui n'a pas eu lieu.
    expect(mockAuditLog).not.toHaveBeenCalled();
  });

  it('accepte et journalise dès qu’une note bascule', async () => {
    mockFrom
      .mockImplementationOnce(() => makeChain({ data: EVALUATION }))
      .mockImplementationOnce(() => makeChain({ count: 1 }));
    mockRpc.mockResolvedValue({ data: 27, error: null });

    await expect(soumettreNotes('eval1')).resolves.toBe(27);
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SOUMETTRE_NOTES', nouvelleValeur: { nombreNotes: 27 } }),
    );
  });

  it('traite une réponse nulle comme zéro, et refuse aussi', async () => {
    // `data` nul plutôt que `0` : le contrat de la RPC ne le garantit pas, et
    // `null === 0` est faux — une comparaison stricte mal placée rouvrirait le
    // trou exactement là où on vient de le fermer.
    mockFrom
      .mockImplementationOnce(() => makeChain({ data: EVALUATION }))
      .mockImplementationOnce(() => makeChain({ count: 1 }));
    mockRpc.mockResolvedValue({ data: null, error: null });

    await expect(soumettreNotes('eval1')).rejects.toThrow(/Aucune note à soumettre/);
  });
});

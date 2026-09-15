import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Le directeur qui enseigne une matière.
 *
 * Beaucoup de directeurs d'écoles privées togolaises tiennent une classe. La
 * règle retenue : **le droit de saisir une note vient de l'affectation, pas du
 * rôle** — la même doctrine que la RLS depuis le 2026-09-11.
 *
 * Ce qui est éprouvé ici est la paire de règles qui va avec, et qui ne se voit
 * pas à l'écran :
 *
 * - un directeur **non affecté** reste refusé, exactement comme un enseignant
 *   qui viserait la classe d'un collègue ;
 * - il ne valide pas ses propres notes **tant que quelqu'un d'autre peut le
 *   faire**, et il les valide quand il est seul — sans quoi une école d'un
 *   seul administrateur n'aurait plus aucune note officielle, et rien à
 *   l'écran ne dirait comment s'en sortir.
 */

const mockGetTenantContext = vi.fn();
vi.mock('../tenant', () => ({
  getTenantContext: () => mockGetTenantContext(),
}));

const { mockAuditLog } = vi.hoisted(() => ({
  mockAuditLog: vi.fn(async (..._args: unknown[]) => undefined),
}));
vi.mock('../audit', () => ({ auditLog: mockAuditLog }));

const mockGetEnseignant = vi.fn();
vi.mock('../enseignant', () => ({
  getEnseignantParUtilisateur: (...args: unknown[]) => mockGetEnseignant(...args),
}));

vi.mock('../pin', () => ({
  verifyPin: async () => true,
  exigerPin: async () => undefined,
}));

function makeChain(result: { data?: unknown; error?: unknown; count?: number }) {
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'neq', 'insert', 'update', 'upsert', 'in', 'order', 'limit']) {
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

import { saisirNote, validerSoumissionEvaluation } from '../note';

const DIRECTEUR = {
  userId: 'u-dir',
  etablissementId: 'etab1',
  role: 'DIRECTEUR',
  email: 'dir@ecole.tg',
};
const SECRETAIRE = {
  userId: 'u-sec',
  etablissementId: 'etab1',
  role: 'SECRETAIRE',
  email: 'sec@ecole.tg',
};

const EVALUATION = {
  id: 'eval1',
  anneeScolaireId: 'annee1',
  classeId: 'classe1',
  matiereId: 'mat1',
  type: 'DEVOIR',
  periode: 'TRIMESTRE_1',
  numero: 1,
};

describe('Un directeur qui enseigne saisit ses notes', () => {
  beforeEach(() => {
    mockFrom.mockReset();
    mockRpc.mockReset();
    mockAuditLog.mockClear();
    mockGetTenantContext.mockReset();
    mockGetEnseignant.mockReset();
  });

  it("saisit la note de la matière qu'il enseigne", async () => {
    mockGetTenantContext.mockResolvedValue(DIRECTEUR);
    mockGetEnseignant.mockResolvedValue({ id: 'ens-dir' });

    mockFrom
      .mockImplementationOnce(() => makeChain({ data: EVALUATION })) // evaluation
      .mockImplementationOnce(() => makeChain({ count: 1 })) // affectation trouvée
      .mockImplementationOnce(() => makeChain({ data: null })) // note existante
      .mockImplementationOnce(() =>
        makeChain({ data: { id: 'n1', valeur: 15, statut: 'BROUILLON' } }),
      );

    const note = await saisirNote('eval1', 'eleve1', 15);
    expect(note.statut).toBe('BROUILLON');
  });

  it("est refusé sur une matière qu'il n'enseigne pas", async () => {
    mockGetTenantContext.mockResolvedValue(DIRECTEUR);
    mockGetEnseignant.mockResolvedValue({ id: 'ens-dir' });

    mockFrom
      .mockImplementationOnce(() => makeChain({ data: EVALUATION }))
      .mockImplementationOnce(() => makeChain({ count: 0 })); // aucune affectation

    // Le rôle ne suffit pas, et c'est tout l'intérêt : sans cette règle,
    // ouvrir la saisie au DIRECTEUR lui donnait les notes de toute l'école.
    await expect(saisirNote('eval1', 'eleve1', 15)).rejects.toThrow("pas affecté");
  });

  it("est refusé quand aucune fiche enseignant n'est rattachée à son compte", async () => {
    mockGetTenantContext.mockResolvedValue(DIRECTEUR);
    mockGetEnseignant.mockResolvedValue(null);
    mockFrom.mockImplementationOnce(() => makeChain({ data: EVALUATION }));

    await expect(saisirNote('eval1', 'eleve1', 15)).rejects.toThrow("pas affecté");
  });
});

describe('Personne ne valide ses propres notes, tant qu’il y a quelqu’un d’autre', () => {
  beforeEach(() => {
    mockFrom.mockReset();
    mockRpc.mockReset();
    mockAuditLog.mockClear();
    mockGetTenantContext.mockReset();
    mockGetEnseignant.mockReset();
  });

  it('refuse au directeur de valider la matière qu’il enseigne quand une secrétaire existe', async () => {
    mockGetTenantContext.mockResolvedValue(DIRECTEUR);
    mockGetEnseignant.mockResolvedValue({ id: 'ens-dir' });

    mockFrom
      .mockImplementationOnce(() => makeChain({ data: EVALUATION }))
      .mockImplementationOnce(() => makeChain({ count: 1 })) // c'est bien son cours
      .mockImplementationOnce(() => makeChain({ count: 1 })); // et un autre peut valider

    await expect(validerSoumissionEvaluation('eval1', '1234')).rejects.toThrow(
      /revient à quelqu/,
    );
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('laisse passer quand il est le seul administrateur, et le consigne', async () => {
    mockGetTenantContext.mockResolvedValue(DIRECTEUR);
    mockGetEnseignant.mockResolvedValue({ id: 'ens-dir' });

    mockFrom
      .mockImplementationOnce(() => makeChain({ data: EVALUATION }))
      .mockImplementationOnce(() => makeChain({ count: 1 })) // son cours
      .mockImplementationOnce(() => makeChain({ count: 0 })); // personne d'autre
    mockRpc.mockResolvedValue({ data: 27, error: null });

    // Bloquer ici enfermerait une école d'un seul administrateur : plus aucune
    // note de sa matière ne pourrait devenir officielle.
    await expect(validerSoumissionEvaluation('eval1', '1234')).resolves.toBe(27);
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'VALIDER_SOUMISSION_NOTES',
        nouvelleValeur: { nombreNotes: 27, autoValidation: true },
      }),
    );
  });

  it('ne consigne rien de particulier quand le valideur n’enseigne pas la matière', async () => {
    mockGetTenantContext.mockResolvedValue(SECRETAIRE);
    mockGetEnseignant.mockResolvedValue(null);

    mockFrom.mockImplementationOnce(() => makeChain({ data: EVALUATION }));
    mockRpc.mockResolvedValue({ data: 30, error: null });

    await expect(validerSoumissionEvaluation('eval1', '1234')).resolves.toBe(30);
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ nouvelleValeur: { nombreNotes: 30 } }),
    );
  });
});

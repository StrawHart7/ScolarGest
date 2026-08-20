import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetTenantContext = vi.fn();
vi.mock('../tenant', () => ({
  getTenantContext: () => mockGetTenantContext(),
}));
vi.mock('../audit', () => ({ auditLog: vi.fn(async () => undefined) }));
vi.mock('../enseignant', () => ({
  getEnseignantParUtilisateur: vi.fn(async () => ({ id: 'ens1' })),
}));

const mockVerifyPin = vi.fn();
// `exigerPin` (step-up partagé) lit le hash en base puis délègue à
// `verifyPin`. Le mock reproduit ce contrat : la vérification du PIN reste
// pilotée par `mockVerifyPin`, comme avant l'extraction depuis note.ts.
vi.mock('../pin', () => ({
  verifyPin: (...args: unknown[]) => mockVerifyPin(...args),
  exigerPin: async (pin: string) => {
    if (!(await mockVerifyPin(pin, 'hash'))) throw new Error('PIN invalide.');
  },
}));

function makeChain(result: { data: unknown; error: unknown; count?: number }) {
  const chain: Record<string, unknown> = {};
  const methods = ['select', 'eq', 'insert', 'update', 'upsert', 'in', 'order'];
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
    rpc: vi.fn(),
  }),
}));

import { saisirNote, demanderModification, approuverModification } from '../note';

describe('saisirNote', () => {
  beforeEach(() => {
    mockGetTenantContext.mockResolvedValue({
      userId: 'u1',
      etablissementId: 'etab1',
      role: 'ENSEIGNANT',
      email: 'a@a.com',
    });
    mockFrom.mockReset();
  });

  it('saisie libre en BROUILLON quand aucune note n\'existe encore', async () => {
    // 1) evaluation lookup, 2) affectation count, 3) existing note lookup, 4) upsert
    const evalChain = makeChain({
      data: { id: 'eval1', anneeScolaireId: 'annee1', classeId: 'classe1', matiereId: 'mat1', type: 'DEVOIR', periode: 'TRIMESTRE_1', numero: 1 },
      error: null,
    });
    const affectationChain = makeChain({ data: null, error: null, count: 1 });
    const existingChain = makeChain({ data: null, error: null });
    const upsertChain = makeChain({
      data: { id: 'note1', evaluationId: 'eval1', eleveId: 'eleve1', valeur: 15, statut: 'BROUILLON' },
      error: null,
    });

    mockFrom
      .mockImplementationOnce(() => evalChain)
      .mockImplementationOnce(() => affectationChain)
      .mockImplementationOnce(() => existingChain)
      .mockImplementationOnce(() => upsertChain);

    const note = await saisirNote('eval1', 'eleve1', 15);

    expect(note.statut).toBe('BROUILLON');
    expect(upsertChain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ valeur: 15, statut: 'BROUILLON' }),
      { onConflict: 'evaluationId,eleveId' },
    );
  });

  it('refuse de modifier une note déjà SOUMISE (doit passer par demanderModification)', async () => {
    const evalChain = makeChain({
      data: { id: 'eval1', anneeScolaireId: 'annee1', classeId: 'classe1', matiereId: 'mat1', type: 'DEVOIR', periode: 'TRIMESTRE_1', numero: 1 },
      error: null,
    });
    const affectationChain = makeChain({ data: null, error: null, count: 1 });
    const existingChain = makeChain({
      data: { id: 'note1', statut: 'SOUMISE', valeur: 12 },
      error: null,
    });

    mockFrom
      .mockImplementationOnce(() => evalChain)
      .mockImplementationOnce(() => affectationChain)
      .mockImplementationOnce(() => existingChain);

    await expect(saisirNote('eval1', 'eleve1', 18)).rejects.toThrow('demande de modification');
  });
});

describe('demanderModification', () => {
  beforeEach(() => {
    mockGetTenantContext.mockResolvedValue({
      userId: 'u2',
      etablissementId: 'etab1',
      role: 'SECRETAIRE',
      email: 'a@a.com',
    });
    mockFrom.mockReset();
  });

  it('modification d\'une note SOUMISE bascule en EN_ATTENTE sans changer `valeur`', async () => {
    const existingChain = makeChain({
      data: { id: 'note1', statut: 'SOUMISE', valeur: 12, observation: null },
      error: null,
    });
    const updateChain = makeChain({
      data: { id: 'note1', statut: 'EN_ATTENTE', valeur: 12, valeurProposee: 16 },
      error: null,
    });

    mockFrom.mockImplementationOnce(() => existingChain).mockImplementationOnce(() => updateChain);

    const note = await demanderModification('note1', 16);

    expect(note.statut).toBe('EN_ATTENTE');
    expect(note.valeur).toBe(12);
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ statut: 'EN_ATTENTE', valeurProposee: 16, demandePar: 'u2' }),
    );
  });
});

describe('approuverModification', () => {
  beforeEach(() => {
    mockGetTenantContext.mockResolvedValue({
      userId: 'u2',
      etablissementId: 'etab1',
      role: 'SECRETAIRE',
      email: 'a@a.com',
    });
    mockFrom.mockReset();
    mockVerifyPin.mockReset();
  });

  it('mauvais PIN échoue et n\'altère rien', async () => {
    mockVerifyPin.mockResolvedValue(false);

    await expect(approuverModification('note1', '000000')).rejects.toThrow('PIN invalide');
    expect(mockFrom).not.toHaveBeenCalled(); // rien n'est lu ni écrit
  });

  it('bon PIN applique valeurProposee → valeur et statut VALIDE', async () => {
    const existingChain = makeChain({
      data: { id: 'note1', statut: 'EN_ATTENTE', valeur: 12, valeurProposee: 16 },
      error: null,
    });
    const updateChain = makeChain({
      data: { id: 'note1', statut: 'VALIDE', valeur: 16, valeurProposee: null },
      error: null,
    });

    mockFrom
      .mockImplementationOnce(() => existingChain)
      .mockImplementationOnce(() => updateChain);
    mockVerifyPin.mockResolvedValue(true);

    const note = await approuverModification('note1', '123456');

    expect(note.valeur).toBe(16);
    expect(note.statut).toBe('VALIDE');
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ valeur: 16, valeurProposee: null, statut: 'VALIDE' }),
    );
  });
});

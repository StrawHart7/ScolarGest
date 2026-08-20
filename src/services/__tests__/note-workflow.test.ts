import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetTenantContext = vi.fn();
vi.mock('../tenant', () => ({
  getTenantContext: () => mockGetTenantContext(),
}));

const { mockAuditLog } = vi.hoisted(() => ({
  mockAuditLog: vi.fn(async (..._args: unknown[]) => undefined),
}));
vi.mock('../audit', () => ({ auditLog: mockAuditLog }));

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
const mockRpc = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    from: (table: string) => mockFrom(table),
    rpc: (...args: unknown[]) => mockRpc(...args),
  }),
}));

import { saisirNote, soumettreNotes, demanderModification, approuverModification, rejeterModification } from '../note';

const ENSEIGNANT_CTX = { userId: 'u-ens', etablissementId: 'etab1', role: 'ENSEIGNANT', email: 'ens@a.com' };
const SECRETAIRE_CTX = { userId: 'u-sec', etablissementId: 'etab1', role: 'SECRETAIRE', email: 'sec@a.com' };

const EVALUATION_ROW = {
  id: 'eval1',
  anneeScolaireId: 'annee1',
  classeId: 'classe1',
  matiereId: 'mat1',
  type: 'DEVOIR',
  periode: 'TRIMESTRE_1',
  numero: 1,
};

describe('Cycle complet: saisie -> soumission -> demande de modification -> approbation/rejet', () => {
  beforeEach(() => {
    mockFrom.mockReset();
    mockRpc.mockReset();
    mockAuditLog.mockClear();
    mockVerifyPin.mockReset();
    mockGetTenantContext.mockReset();
  });

  it('1. saisirNote crée la note en statut BROUILLON', async () => {
    mockGetTenantContext.mockResolvedValue(ENSEIGNANT_CTX);

    const evalChain = makeChain({ data: EVALUATION_ROW, error: null });
    const affectationChain = makeChain({ data: null, error: null, count: 1 });
    const existingChain = makeChain({ data: null, error: null });
    const upsertChain = makeChain({
      data: { id: 'note1', evaluationId: 'eval1', eleveId: 'eleve1', valeur: 14, statut: 'BROUILLON' },
      error: null,
    });

    mockFrom
      .mockImplementationOnce(() => evalChain)
      .mockImplementationOnce(() => affectationChain)
      .mockImplementationOnce(() => existingChain)
      .mockImplementationOnce(() => upsertChain);

    const note = await saisirNote('eval1', 'eleve1', 14);

    expect(note.statut).toBe('BROUILLON');
    expect(note.valeur).toBe(14);
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SAISIR_NOTE', objetId: 'note1' }),
    );
  });

  it('2. soumettreNotes bascule les BROUILLON en SOUMISE via la RPC', async () => {
    mockGetTenantContext.mockResolvedValue(ENSEIGNANT_CTX);

    const evalChain = makeChain({ data: EVALUATION_ROW, error: null });
    const affectationChain = makeChain({ data: null, error: null, count: 1 });

    mockFrom.mockImplementationOnce(() => evalChain).mockImplementationOnce(() => affectationChain);
    mockRpc.mockResolvedValue({ data: 1, error: null });

    const nombre = await soumettreNotes('eval1');

    expect(nombre).toBe(1);
    expect(mockRpc).toHaveBeenCalledWith('fn_soumettre_notes', { p_evaluation_id: 'eval1' });
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SOUMETTRE_NOTES', objetId: 'eval1' }),
    );
  });

  it('3. demanderModification stocke valeurProposee sans toucher `valeur`, statut EN_ATTENTE', async () => {
    mockGetTenantContext.mockResolvedValue(SECRETAIRE_CTX);

    const existingChain = makeChain({
      data: { id: 'note1', statut: 'SOUMISE', valeur: 14, observation: null },
      error: null,
    });
    const updateChain = makeChain({
      data: {
        id: 'note1',
        statut: 'EN_ATTENTE',
        valeur: 14,
        valeurProposee: 17,
        demandePar: 'u-sec',
        observation: 'Erreur de saisie',
      },
      error: null,
    });

    mockFrom.mockImplementationOnce(() => existingChain).mockImplementationOnce(() => updateChain);

    const note = await demanderModification('note1', 17, 'Erreur de saisie');

    expect(note.statut).toBe('EN_ATTENTE');
    expect(note.valeur).toBe(14); // valeur d'origine inchangée
    expect(note.valeurProposee).toBe(17);
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ statut: 'EN_ATTENTE', valeurProposee: 17, demandePar: 'u-sec' }),
    );
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DEMANDER_MODIFICATION_NOTE', objetId: 'note1' }),
    );
  });

  describe('4. approuverModification', () => {
    beforeEach(() => {
      mockGetTenantContext.mockResolvedValue(SECRETAIRE_CTX);
    });

    it('mauvais PIN: échoue, rien n\'est modifié, auditLog PAS appelé', async () => {
      mockVerifyPin.mockResolvedValue(false);

      await expect(approuverModification('note1', '000000')).rejects.toThrow('PIN invalide');

      // Le step-up PIN vit dans `pin.ts` depuis la Phase 8.5 : un PIN refusé
      // n'entraîne plus aucune requête depuis `note.ts`.
      expect(mockFrom).not.toHaveBeenCalled();
      expect(mockAuditLog).not.toHaveBeenCalled();
    });

    it('bon PIN: statut VALIDE, valeur = ancienne valeurProposee, auditLog appelé', async () => {
      const existingChain = makeChain({
        data: { id: 'note1', statut: 'EN_ATTENTE', valeur: 14, valeurProposee: 17 },
        error: null,
      });
      const updateChain = makeChain({
        data: { id: 'note1', statut: 'VALIDE', valeur: 17, valeurProposee: null },
        error: null,
      });

      mockFrom
        .mockImplementationOnce(() => existingChain)
        .mockImplementationOnce(() => updateChain);
      mockVerifyPin.mockResolvedValue(true);

      const note = await approuverModification('note1', '123456');

      expect(note.statut).toBe('VALIDE');
      expect(note.valeur).toBe(17);
      expect(updateChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ valeur: 17, valeurProposee: null, statut: 'VALIDE' }),
      );
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'APPROUVER_MODIFICATION_NOTE',
          objetId: 'note1',
          ancienneValeur: { valeur: 14 },
          nouvelleValeur: { valeur: 17 },
        }),
      );
    });
  });

  describe('5. rejeterModification', () => {
    beforeEach(() => {
      mockGetTenantContext.mockResolvedValue(SECRETAIRE_CTX);
    });

    it('mauvais PIN: échoue, rien n\'est modifié, auditLog PAS appelé', async () => {
      mockVerifyPin.mockResolvedValue(false);

      await expect(rejeterModification('note1', '999999', 'Motif')).rejects.toThrow('PIN invalide');

      expect(mockFrom).not.toHaveBeenCalled();
      expect(mockAuditLog).not.toHaveBeenCalled();
    });

    it('bon PIN: statut REJETE, valeur d\'origine conservée, auditLog appelé', async () => {
      const existingChain = makeChain({
        data: { id: 'note1', statut: 'EN_ATTENTE', valeur: 14, valeurProposee: 17 },
        error: null,
      });
      const updateChain = makeChain({
        data: { id: 'note1', statut: 'REJETE', valeur: 14, valeurProposee: null, observation: 'Non justifié' },
        error: null,
      });

      mockFrom
        .mockImplementationOnce(() => existingChain)
        .mockImplementationOnce(() => updateChain);
      mockVerifyPin.mockResolvedValue(true);

      const note = await rejeterModification('note1', '123456', 'Non justifié');

      expect(note.statut).toBe('REJETE');
      expect(note.valeur).toBe(14); // valeur d'origine conservée, valeurProposee jamais appliquée
      expect(updateChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ statut: 'REJETE', valeurProposee: null, observation: 'Non justifié' }),
      );
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'REJETER_MODIFICATION_NOTE', objetId: 'note1' }),
      );
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetTenantContext = vi.fn();
vi.mock('../tenant', () => ({
  getTenantContext: () => mockGetTenantContext(),
}));
const mockAuditLog = vi.fn(async (..._args: unknown[]) => undefined);
vi.mock('../audit', () => ({ auditLog: (...args: unknown[]) => mockAuditLog(...args) }));

const mockRpc = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    rpc: (fn: string, params: unknown) => mockRpc(fn, params),
    from: () => {
      const chain: Record<string, unknown> = {};
      for (const m of ['select', 'eq']) chain[m] = vi.fn(() => chain);
      chain.maybeSingle = vi.fn(async () => ({ data: null, error: null }));
      return chain;
    },
  }),
}));

import { enregistrerPaiement, annulerPaiement } from '../paiement';

const CTX_COMPTABLE = {
  userId: 'u1',
  etablissementId: 'etab1',
  role: 'COMPTABLE',
  email: 'compta@ecole.tg',
};

describe('enregistrerPaiement', () => {
  beforeEach(() => {
    mockGetTenantContext.mockResolvedValue(CTX_COMPTABLE);
    mockRpc.mockReset();
    mockAuditLog.mockClear();
  });

  it('appelle la RPC transactionnelle et journalise l audit', async () => {
    mockRpc.mockResolvedValue({
      data: {
        paiementId: 'p1',
        montantTotal: 250000,
        totalPaye: 100000,
        solde: 150000,
        statut: 'PARTIEL',
      },
      error: null,
    });

    const resultat = await enregistrerPaiement({
      factureId: 'f1',
      montant: 100000,
      modePaiement: 'ESPECES',
    });

    expect(mockRpc).toHaveBeenCalledWith('fn_enregistrer_paiement', {
      p_facture_id: 'f1',
      p_montant: 100000,
      p_mode_paiement: 'ESPECES',
      p_reference: null,
      p_date_paiement: null,
    });
    expect(resultat.solde).toBe(150000);
    expect(resultat.statut).toBe('PARTIEL');
    expect(mockAuditLog).toHaveBeenCalledOnce();
  });

  it('refuse un montant nul ou négatif sans toucher la base', async () => {
    await expect(
      enregistrerPaiement({ factureId: 'f1', montant: 0, modePaiement: 'ESPECES' }),
    ).rejects.toThrow(/strictement positif/);
    await expect(
      enregistrerPaiement({ factureId: 'f1', montant: -5000, modePaiement: 'ESPECES' }),
    ).rejects.toThrow(/strictement positif/);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('exige une référence hors espèces', async () => {
    await expect(
      enregistrerPaiement({ factureId: 'f1', montant: 50000, modePaiement: 'CHEQUE' }),
    ).rejects.toThrow(/référence est requise/);
    await expect(
      enregistrerPaiement({
        factureId: 'f1',
        montant: 50000,
        modePaiement: 'MOBILE_MONEY',
        reference: '   ',
      }),
    ).rejects.toThrow(/référence est requise/);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('remonte le refus de dépassement du solde émis par la base', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'Montant supérieur au solde restant (70000 FCFA).' },
    });

    await expect(
      enregistrerPaiement({ factureId: 'f1', montant: 100000, modePaiement: 'ESPECES' }),
    ).rejects.toThrow(/solde restant/);
    expect(mockAuditLog).not.toHaveBeenCalled();
  });

  it('refuse un rôle non autorisé (Directeur = lecture seule sur la finance)', async () => {
    mockGetTenantContext.mockResolvedValue({ ...CTX_COMPTABLE, role: 'DIRECTEUR' });
    await expect(
      enregistrerPaiement({ factureId: 'f1', montant: 50000, modePaiement: 'ESPECES' }),
    ).rejects.toThrow(/Accès refusé/);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('autorise la Secrétaire (écriture finance complète, contexte togolais)', async () => {
    mockGetTenantContext.mockResolvedValue({ ...CTX_COMPTABLE, role: 'SECRETAIRE' });
    mockRpc.mockResolvedValue({
      data: { paiementId: 'p1', montantTotal: 100000, totalPaye: 50000, solde: 50000, statut: 'PARTIEL' },
      error: null,
    });
    await expect(
      enregistrerPaiement({ factureId: 'f1', montant: 50000, modePaiement: 'ESPECES' }),
    ).resolves.toMatchObject({ paiementId: 'p1' });
  });
});

describe('annulerPaiement', () => {
  beforeEach(() => {
    mockGetTenantContext.mockResolvedValue(CTX_COMPTABLE);
    mockRpc.mockReset();
    mockAuditLog.mockClear();
  });

  it('passe par la RPC et trace le motif', async () => {
    mockRpc.mockResolvedValue({
      data: { factureId: 'f1', solde: 250000, statut: 'IMPAYE' },
      error: null,
    });

    await annulerPaiement('p1', 'Chèque sans provision');

    expect(mockRpc).toHaveBeenCalledWith('fn_annuler_paiement', { p_paiement_id: 'p1' });
    expect(mockAuditLog).toHaveBeenCalledOnce();
    const arg = mockAuditLog.mock.calls[0]?.[0] as unknown as {
      action: string;
      nouvelleValeur: { motif: string };
    };
    expect(arg.action).toBe('ANNULER_PAIEMENT');
    expect(arg.nouvelleValeur.motif).toBe('Chèque sans provision');
  });

  it('remonte le refus d une double annulation', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'Ce versement est déjà annulé.' } });
    await expect(annulerPaiement('p1')).rejects.toThrow(/déjà annulé/);
  });
});

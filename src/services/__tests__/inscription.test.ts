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

import {
  creerInscriptionAvecFacture,
  annulerInscription,
  changerClasseInscription,
} from '../inscription';

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

describe('annulerInscription', () => {
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
});

/**
 * `reinscrireEleve` a été supprimée : elle changeait la classe **sans toucher à
 * la facture**, et n'était appelée par aucun écran — le défaut n'avait donc
 * jamais tiré. `changerClasseInscription` la remplace et réactive aussi, en
 * refaisant la facture. Voir la migration `20260915211046`.
 */
describe('changerClasseInscription', () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockUpdate.mockReset();
    mockGetTenantContext.mockResolvedValue({
      userId: 'u1',
      etablissementId: 'etab1',
      role: 'SECRETAIRE',
      email: 'a@a.com',
    });
  });

  it('délègue tout à la RPC, dans une seule transaction', async () => {
    // Le point du test : le service **n'écrit pas lui-même**. Quatre écritures
    // séparées ici laisseraient un élève sans facture si la troisième échouait.
    mockRpc.mockResolvedValue({
      data: {
        inscriptionId: 'insc1',
        ancienneClasseId: 'c1',
        nouvelleClasseId: 'c2',
        factureId: 'f2',
        ancienneFactureId: 'f1',
        paiementsReportes: 2,
        surplus: 0,
        montantTotal: 150000,
        totalPaye: 50000,
        solde: 100000,
        statut: 'PARTIEL',
      },
      error: null,
    });

    const resultat = await changerClasseInscription('insc1', 'c2');

    expect(mockRpc).toHaveBeenCalledWith('fn_changer_classe_inscription', {
      p_etablissement_id: 'etab1',
      p_inscription_id: 'insc1',
      p_classe_id: 'c2',
    });
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(resultat.factureId).toBe('f2');
    expect(resultat.paiementsReportes).toBe(2);
  });

  it('remonte le refus de la base tel qu’il est écrit', async () => {
    // Les messages de `fn_changer_classe_inscription` s'adressent à l'école :
    // les remplacer par un texte générique perdrait le nom de la classe et la
    // raison du refus.
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'Cet eleve est deja inscrit dans cette classe.' },
    });

    await expect(changerClasseInscription('insc1', 'c1')).rejects.toThrow(
      'Cet eleve est deja inscrit dans cette classe.',
    );
  });
});

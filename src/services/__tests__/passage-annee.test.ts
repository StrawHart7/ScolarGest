import { describe, it, expect, vi, beforeEach } from 'vitest';
import { proposerDecisions, type InscriptionACloturer } from '../passage-annee';

const mockGetTenantContext = vi.fn();
vi.mock('../tenant', () => ({
  getTenantContext: () => mockGetTenantContext(),
}));
vi.mock('../audit', () => ({ auditLog: vi.fn(async () => undefined) }));

const mockRpc = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    rpc: (...args: unknown[]) => mockRpc(...args),
  }),
}));

import { validerPassageCohorte } from '../passage-annee';

describe('proposerDecisions', () => {
  it('propose ADMIS quand le niveau a un niveau suivant', () => {
    const inscriptions: InscriptionACloturer[] = [
      {
        inscriptionId: 'i1',
        eleveId: 'e1',
        eleveNom: 'Doe',
        elevePrenoms: 'John',
        classeId: 'c1',
        classeNom: '6e A',
        niveauId: 'n1',
        niveauSuivantId: 'n2',
      },
    ];
    expect(proposerDecisions(inscriptions)[0]!.decisionProposee).toBe('ADMIS');
  });

  it('propose DEPART quand il n\'y a pas de niveau suivant (dernière classe du cursus)', () => {
    const inscriptions: InscriptionACloturer[] = [
      {
        inscriptionId: 'i1',
        eleveId: 'e1',
        eleveNom: 'Doe',
        elevePrenoms: 'John',
        classeId: 'c1',
        classeNom: 'Terminale',
        niveauId: 'n1',
        niveauSuivantId: null,
      },
    ];
    expect(proposerDecisions(inscriptions)[0]!.decisionProposee).toBe('DEPART');
  });
});

describe('validerPassageCohorte', () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockGetTenantContext.mockResolvedValue({
      userId: 'u1',
      etablissementId: 'etab1',
      role: 'SECRETAIRE',
      email: 'a@a.com',
    });
  });

  it('ADMIS obtient une nouvelle inscription + facture dans l\'année cible', async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          eleveId: 'e1',
          ok: true,
          message: 'OK',
          inscriptionCibleId: 'insc-new',
          factureCibleId: 'fact-new',
        },
      ],
      error: null,
    });

    const result = await validerPassageCohorte('annee-cible', [
      { eleveId: 'e1', inscriptionSourceId: 'i1', decision: 'ADMIS', classeCibleId: 'c2' },
    ]);

    expect(result[0]!).toMatchObject({
      ok: true,
      inscriptionCibleId: 'insc-new',
      factureCibleId: 'fact-new',
    });
  });

  it('DEPART n\'obtient aucune nouvelle inscription (pas de inscriptionCibleId)', async () => {
    mockRpc.mockResolvedValue({
      data: [{ eleveId: 'e2', ok: true, message: 'Départ enregistré' }],
      error: null,
    });

    const result = await validerPassageCohorte('annee-cible', [
      { eleveId: 'e2', inscriptionSourceId: 'i2', decision: 'DEPART' },
    ]);

    expect(result[0]!.ok).toBe(true);
    expect(result[0]!.inscriptionCibleId).toBeUndefined();
  });

  it('une ré-exécution ne duplique pas (la RPC renvoie un message "déjà inscrit / ignoré")', async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          eleveId: 'e1',
          ok: true,
          message: "Déjà inscrit dans l'année cible (ignoré)",
        },
      ],
      error: null,
    });

    const result = await validerPassageCohorte('annee-cible', [
      { eleveId: 'e1', inscriptionSourceId: 'i1', decision: 'ADMIS', classeCibleId: 'c2' },
    ]);

    expect(result[0]!.ok).toBe(true);
    expect(result[0]!.message).toMatch(/ignoré/);
  });
});

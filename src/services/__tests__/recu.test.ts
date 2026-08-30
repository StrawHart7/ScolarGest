import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetTenantContext = vi.fn();
vi.mock('../tenant', () => ({
  getTenantContext: () => mockGetTenantContext(),
}));

const { mockAuditLog } = vi.hoisted(() => ({
  mockAuditLog: vi.fn(async (..._args: unknown[]) => undefined),
}));
vi.mock('../audit', () => ({ auditLog: mockAuditLog }));

const mockGetPaiementDetail = vi.fn();
vi.mock('../paiement', () => ({
  getPaiementDetail: (...args: unknown[]) => mockGetPaiementDetail(...args),
}));

const mockGetEtablissement = vi.fn();
vi.mock('../etablissement', () => ({
  getEtablissement: (...args: unknown[]) => mockGetEtablissement(...args),
}));

const mockGenerateNumeroDocument = vi.fn();
vi.mock('../document-numero', () => ({
  generateNumeroDocument: (...args: unknown[]) => mockGenerateNumeroDocument(...args),
}));

const mockEnregistrerDocument = vi.fn();
vi.mock('../document', () => ({
  enregistrerDocument: (...args: unknown[]) => mockEnregistrerDocument(...args),
}));

const mockRenderHtmlToPdf = vi.fn();
vi.mock('@/lib/pdf/render', () => ({
  renderHtmlToPdf: (...args: unknown[]) => mockRenderHtmlToPdf(...args),
}));

const mockUpload = vi.fn();
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    storage: {
      from: () => ({ upload: (...args: unknown[]) => mockUpload(...args) }),
    },
  }),
}));

// L'identité visuelle (logo, filigrane) est testée pour elle-même ailleurs :
// ici on la neutralise pour que le test reste centré sur la génération du reçu.
vi.mock('../parametres-document', () => ({
  getParametresDocument: vi.fn(async () => ({
    filigraneTexte: null,
    filigraneActif: false,
    logoChemin: null,
    dejaConfigure: false,
  })),
  chargerLogoDataUri: vi.fn(async () => null),
}));

function makeChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  const methods = ['select', 'eq'];
  for (const m of methods) chain[m] = vi.fn(() => chain);
  chain.single = vi.fn(async () => result);
  return chain;
}
const mockFrom = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ from: (table: string) => mockFrom(table) }),
}));

import { genererRecuPaiement } from '../recu';

const CTX = { userId: 'u-sec', etablissementId: 'etab1', role: 'SECRETAIRE', email: 'sec@a.com' };

const PAIEMENT_DETAIL = {
  id: 'paiement1',
  factureId: 'facture1',
  montant: 75000,
  datePaiement: '2024-10-24T00:00:00Z',
  modePaiement: 'VIREMENT',
  reference: 'VIR-001',
  statut: 'PAYE',
  eleve: { id: 'eleve1', nom: 'Bamba', prenoms: 'Amadou', matricule: 'STU-2023-1042' },
  classeNom: 'Terminale C',
  responsablePrincipal: { nom: 'Bamba', prenoms: 'Issa' },
  etablissementId: 'etab1',
};

const ETABLISSEMENT = {
  id: 'etab1',
  nom: 'Global Academy',
  sigle: null,
  adresse: '123 Education Boulevard',
  ville: 'EduCity',
  telephone: '+225 01 23 45 67',
  email: 'contact@globalacademy.edu',
  statut: 'ACTIF',
  createdAt: '2024-01-01',
};

describe('genererRecuPaiement', () => {
  beforeEach(() => {
    mockGetTenantContext.mockReset();
    mockAuditLog.mockClear();
    mockGetPaiementDetail.mockReset();
    mockGetEtablissement.mockReset();
    mockGenerateNumeroDocument.mockReset();
    mockEnregistrerDocument.mockReset();
    mockRenderHtmlToPdf.mockReset();
    mockUpload.mockReset();
    mockFrom.mockReset();

    mockGetTenantContext.mockResolvedValue(CTX);
    mockGetPaiementDetail.mockResolvedValue(PAIEMENT_DETAIL);
    mockGetEtablissement.mockResolvedValue(ETABLISSEMENT);
    mockGenerateNumeroDocument.mockResolvedValue('REC-2024-000001');
    mockRenderHtmlToPdf.mockResolvedValue(Buffer.from('%PDF-fake'));
    mockUpload.mockResolvedValue({ data: { path: 'etab1/recus/REC-2024-000001.pdf' }, error: null });
    mockFrom.mockImplementation(() => makeChain({ data: { anneeScolaireId: 'annee1' }, error: null }));
    mockEnregistrerDocument.mockResolvedValue({
      id: 'doc1',
      etablissementId: 'etab1',
      type: 'RECU',
      reference: 'REC-2024-000001',
      cheminFichier: 'etab1/recus/REC-2024-000001.pdf',
      objetType: 'PAIEMENT',
      objetId: 'paiement1',
      dateGeneration: '2024-10-24T00:00:00Z',
      createdById: 'u-sec',
      statut: 'GENERE',
    });
  });

  it('génère le reçu: numérote, uploade, enregistre le document et journalise l\'audit', async () => {
    const document = await genererRecuPaiement('paiement1');

    expect(mockGenerateNumeroDocument).toHaveBeenCalledWith('RECU', 'annee1');
    expect(mockUpload).toHaveBeenCalledWith(
      'etab1/recus/REC-2024-000001.pdf',
      expect.anything(),
      expect.objectContaining({ contentType: 'application/pdf' }),
    );
    expect(mockEnregistrerDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'RECU',
        reference: 'REC-2024-000001',
        objetType: 'PAIEMENT',
        objetId: 'paiement1',
      }),
    );
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'GENERER_RECU', objetId: 'doc1' }),
    );
    expect(document.id).toBe('doc1');
  });

  it('propage une erreur explicite si l\'upload Storage échoue', async () => {
    mockUpload.mockResolvedValue({ data: null, error: { message: 'bucket introuvable' } });

    await expect(genererRecuPaiement('paiement1')).rejects.toThrow('bucket introuvable');
    expect(mockEnregistrerDocument).not.toHaveBeenCalled();
    expect(mockAuditLog).not.toHaveBeenCalled();
  });
});

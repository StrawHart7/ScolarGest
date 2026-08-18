import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetTenantContext = vi.fn();
vi.mock('../tenant', () => ({
  getTenantContext: () => mockGetTenantContext(),
}));
vi.mock('../audit', () => ({ auditLog: vi.fn(async () => undefined) }));

const mockRequireRole = vi.fn();
vi.mock('../authorization', () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));

const mockInviteUtilisateur = vi.fn();
vi.mock('../utilisateur', () => ({
  inviteUtilisateur: (...args: unknown[]) => mockInviteUtilisateur(...args),
}));

const mockCreateMatiere = vi.fn();
vi.mock('../matiere', () => ({
  createMatiere: (...args: unknown[]) => mockCreateMatiere(...args),
}));

const mockGenerateMatricule = vi.fn();
vi.mock('../matricule', () => ({
  generateMatriculeEnseignant: (...args: unknown[]) => mockGenerateMatricule(...args),
}));

const mockRpc = vi.fn();
const mockClasses = vi.fn();
const mockMatieres = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === 'classe') {
        return {
          select: () => ({
            eq: () => ({
              eq: async () => mockClasses(),
            }),
          }),
        };
      }
      if (table === 'matiere') {
        return {
          select: () => ({
            eq: async () => mockMatieres(),
          }),
        };
      }
      throw new Error(`Unexpected table in test mock: ${table}`);
    },
    rpc: (...args: unknown[]) => mockRpc(...args),
  }),
}));

import { importerLignesValides } from '../import-enseignants';
import type { EnseignantImportLigne } from '@/lib/import/enseignant-import-schema';

function ligne(overrides: Partial<EnseignantImportLigne> & { ligne?: number } = {}): {
  ligne: number;
  data: EnseignantImportLigne;
} {
  const { ligne: numeroLigne, ...dataOverrides } = overrides;
  return {
    ligne: numeroLigne ?? 2,
    data: {
      nom: 'Amegan',
      prenoms: 'Koffi',
      sexe: 'M',
      email: 'koffi.amegan@example.com',
      telephone: '90000000',
      date_naissance: '1985-04-12',
      date_embauche: '2020-09-01',
      matricule_ancien: '',
      classe: '6e A',
      matiere: 'Mathématiques',
      ...dataOverrides,
    },
  };
}

describe('importerLignesValides (enseignants)', () => {
  beforeEach(() => {
    mockGetTenantContext.mockResolvedValue({
      userId: 'u1',
      etablissementId: 'etab1',
      role: 'SECRETAIRE',
      email: 'a@a.com',
    });
    mockRequireRole.mockResolvedValue({
      userId: 'u1',
      etablissementId: 'etab1',
      role: 'SECRETAIRE',
      email: 'a@a.com',
    });
    mockClasses.mockReturnValue({ data: [{ id: 'classe1', nom: '6e A' }], error: null });
    mockMatieres.mockReturnValue({
      data: [{ id: 'matiere1', nom: 'Mathématiques' }],
      error: null,
    });
    mockGenerateMatricule.mockReset().mockResolvedValue('ENS-2026-0001');
    mockInviteUtilisateur.mockReset().mockResolvedValue({ id: 'util1' });
    mockRpc.mockReset().mockResolvedValue({ data: 'enseignant1', error: null });
    mockCreateMatiere.mockReset();
  });

  it('regroupe deux lignes du même enseignant (même email) en un seul invite + un seul appel RPC portant les deux affectations', async () => {
    const lignes = [
      ligne({ classe: '6e A', matiere: 'Mathématiques' }),
      ligne({ ligne: 3, classe: '6e A', matiere: 'Physique' }),
    ];
    mockMatieres.mockReturnValue({
      data: [
        { id: 'matiere1', nom: 'Mathématiques' },
        { id: 'matiere2', nom: 'Physique' },
      ],
      error: null,
    });

    const rapport = await importerLignesValides(lignes, 'annee1');

    expect(mockInviteUtilisateur).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledTimes(1);
    const [, params] = mockRpc.mock.calls[0] as [string, { p_affectations: unknown[] }];
    expect(params.p_affectations).toHaveLength(2);
    expect(rapport.succes).toBe(2);
    expect(rapport.echecs).toBe(0);
  });

  it("une ligne avec une classe introuvable échoue avec un message clair sans empêcher les autres lignes/enseignants", async () => {
    const lignes = [
      ligne({ email: 'koffi.amegan@example.com', classe: 'Classe inexistante' }),
      ligne({ ligne: 3, email: 'autre@example.com', nom: 'Doe' }),
    ];

    const rapport = await importerLignesValides(lignes, 'annee1');

    const ligneEchouee = rapport.details.find((d) => d.ligne === 2);
    expect(ligneEchouee?.ok).toBe(false);
    expect(ligneEchouee?.message).toMatch(/introuvable/);

    const ligneReussie = rapport.details.find((d) => d.ligne === 3);
    expect(ligneReussie?.ok).toBe(true);

    // Le premier enseignant n'a aucune affectation résolvable: pas d'invite/RPC pour lui.
    expect(mockInviteUtilisateur).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });

  it('deux enseignants différents dans le même fichier obtiennent chacun leur propre invite + appel RPC', async () => {
    const lignes = [
      ligne({ email: 'prof1@example.com' }),
      ligne({ ligne: 3, email: 'prof2@example.com', nom: 'Doe' }),
    ];

    const rapport = await importerLignesValides(lignes, 'annee1');

    expect(mockInviteUtilisateur).toHaveBeenCalledTimes(2);
    expect(mockRpc).toHaveBeenCalledTimes(2);
    expect(rapport.succes).toBe(2);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetTenantContext = vi.fn();
vi.mock('../tenant', () => ({
  getTenantContext: () => mockGetTenantContext(),
}));
vi.mock('../audit', () => ({ auditLog: vi.fn(async () => undefined) }));
vi.mock('../enseignant', () => ({
  getEnseignantParUtilisateur: vi.fn(async () => null),
}));

function makeChain(result: { data: unknown; error: unknown; count?: number }) {
  const chain: Record<string, unknown> = {};
  const methods = ['select', 'eq', 'insert', 'update', 'delete', 'order', 'in', 'neq', 'limit'];
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
  }),
}));

import { creerEvaluation } from '../evaluation';

describe('creerEvaluation', () => {
  beforeEach(() => {
    mockGetTenantContext.mockResolvedValue({
      userId: 'u1',
      etablissementId: 'etab1',
      role: 'DIRECTEUR',
      email: 'a@a.com',
    });
    mockFrom.mockReset();
  });

  /**
   * **Ce test disait l'inverse jusqu'au 2026-09-15** : « refuse une 4e
   * interrogation ». Le plafond de trois a été retiré, et il était infondé —
   * le moteur divise par le **nombre** d'interrogations, quatre donnent un
   * résultat aussi cohérent que trois, et un professeur qui en faisait une
   * quatrième n'avait aucun recours.
   *
   * L'assertion est inversée plutôt que supprimée : c'est le seul endroit qui
   * garde la trace de la règle et de la raison de son retrait.
   */
  it('accepte une 4e interrogation : il n’y a plus de plafond', async () => {
    // La lecture du numéro le plus élevé, puis l'insertion.
    mockFrom
      .mockImplementationOnce(() => makeChain({ data: { numero: 3 }, error: null }))
      .mockImplementationOnce(() => makeChain({ data: { id: 'eval4' }, error: null }));

    await expect(
      creerEvaluation({
        anneeScolaireId: 'annee1',
        classeId: 'classe1',
        matiereId: 'mat1',
        type: 'INTERROGATION',
        periode: 'TRIMESTRE_1',
        date: '2026-01-01',
      }),
    ).resolves.toBe('eval4');
  });

  it('numérote la composition à 1, sans lire la base', async () => {
    // Une seule composition par période : le numéro vaut toujours 1, et c'est
    // la contrainte d'unicité de `0001` qui refuse la seconde. Aucune lecture
    // préalable — s'il en fallait une, elle serait une course entre deux
    // saisies simultanées.
    mockFrom.mockReturnValue(makeChain({ data: { id: 'evalC' }, error: null }));

    await creerEvaluation({
      anneeScolaireId: 'annee1',
      classeId: 'classe1',
      matiereId: 'mat1',
      type: 'COMPOSITION',
      periode: 'TRIMESTRE_1',
      date: '2026-01-01',
    });

    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it('dit qu’une composition existe déjà, sans parler de contrainte', async () => {
    mockFrom.mockReturnValue(
      makeChain({ data: null, error: { code: '23505', message: 'duplicate key value' } }),
    );

    // Le numéro n'étant plus saisi, il n'y a rien à corriger dans le
    // formulaire : le message doit nommer ce qui existe déjà, pas énumérer les
    // colonnes d'une contrainte.
    await expect(
      creerEvaluation({
        anneeScolaireId: 'annee1',
        classeId: 'classe1',
        matiereId: 'mat1',
        type: 'COMPOSITION',
        periode: 'TRIMESTRE_1',
        date: '2026-01-01',
      }),
    ).rejects.toThrow('Une composition existe déjà');
  });

  it('rejette un second devoir sur la même période', async () => {
    mockFrom.mockReturnValue(
      makeChain({ data: null, error: { code: '23505', message: 'duplicate key value' } }),
    );

    await expect(
      creerEvaluation({
        anneeScolaireId: 'annee1',
        classeId: 'classe1',
        matiereId: 'mat1',
        type: 'DEVOIR',
        periode: 'TRIMESTRE_1',
        date: '2026-01-01',
      }),
    ).rejects.toThrow('Un devoir existe déjà');
  });

  it('crée une évaluation valide', async () => {
    mockFrom.mockReturnValue(makeChain({ data: { id: 'eval1' }, error: null }));

    const id = await creerEvaluation({
      anneeScolaireId: 'annee1',
      classeId: 'classe1',
      matiereId: 'mat1',
      type: 'INTERROGATION',
      periode: 'TRIMESTRE_1',
      numero: 2,
      date: '2026-01-01',
    });

    expect(id).toBe('eval1');
  });

  it('respecte un numéro imposé par l’appelant sans rien lire', async () => {
    // L'import de notes porte ses propres numéros : le service doit les
    // reprendre tels quels, sinon un fichier renumérote l'école entière.
    mockFrom.mockReturnValue(makeChain({ data: { id: 'evalX' }, error: null }));

    await creerEvaluation({
      anneeScolaireId: 'annee1',
      classeId: 'classe1',
      matiereId: 'mat1',
      type: 'INTERROGATION',
      periode: 'TRIMESTRE_1',
      numero: 7,
      date: '2026-01-01',
    });

    expect(mockFrom).toHaveBeenCalledTimes(1);
  });
});

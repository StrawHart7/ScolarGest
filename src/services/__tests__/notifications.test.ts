import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Ce que la direction renvoie à l'enseignant.
 *
 * Le point sensible n'est pas le texte, c'est le **filtre** : une classe est
 * partagée entre plusieurs professeurs, et `note` ne porte pas
 * d'`etablissementId`. Se borner à la classe montrerait à un enseignant les
 * retours destinés à ses collègues — le piège est écrit noir sur blanc dans
 * `CLAUDE.md` à propos d'`affectation_enseignant`, et il se rejoue ici.
 */

const mockGetTenantContext = vi.fn();
vi.mock('../tenant', () => ({ getTenantContext: () => mockGetTenantContext() }));

const mockGetEnseignant = vi.fn();
vi.mock('../enseignant', () => ({
  getEnseignantParUtilisateur: (...args: unknown[]) => mockGetEnseignant(...args),
}));

let reponses: { data?: unknown; error?: unknown }[] = [];

function makeChain() {
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'in', 'gte', 'limit', 'order']) chain[m] = vi.fn(() => chain);
  chain.then = (resolve: (v: unknown) => unknown) => {
    const suite = reponses.shift() ?? { data: [] };
    return Promise.resolve({ data: suite.data ?? null, error: suite.error ?? null }).then(resolve);
  };
  return chain;
}

vi.mock('@/lib/supabase/server', () => ({ createClient: () => ({ from: () => makeChain() }) }));

import { notificationsEnseignant, JOURS_VALIDATION_RECENTE } from '../notifications';

const note = (
  classeId: string,
  matiereId: string,
  statut: string,
  motif: string | null,
  noms = { classe: '6ème A', matiere: 'Mathématiques' },
) => ({
  statut,
  updatedAt: new Date().toISOString(),
  motifRejetSoumission: motif,
  evaluation: {
    classeId,
    matiereId,
    type: 'DEVOIR',
    periode: 'TRIMESTRE_1',
    classe: { nom: noms.classe },
    matiere: { nom: noms.matiere },
  },
});

describe('notificationsEnseignant', () => {
  beforeEach(() => {
    reponses = [];
    mockGetTenantContext.mockResolvedValue({
      userId: 'u-ens',
      etablissementId: 'etab1',
      role: 'ENSEIGNANT',
      email: 'ens@ecole.tg',
    });
    mockGetEnseignant.mockResolvedValue({ id: 'ens1' });
  });

  it('annonce un renvoi avec son motif', async () => {
    reponses = [
      { data: [{ classeId: 'c1', matiereId: 'm1' }] },
      { data: [note('c1', 'm1', 'BROUILLON', 'Deux notes au-dessus de 20')] },
    ];

    const n = await notificationsEnseignant();
    expect(n).toHaveLength(1);
    expect(n[0]!.titre).toContain('renvoyées');
    expect(n[0]!.detail).toContain('Deux notes au-dessus de 20');
    expect(n[0]!.urgence).toBe('avertissement');
  });

  it('ne montre pas les retours d’un collègue sur la même classe', async () => {
    reponses = [
      // Il n'enseigne que les mathématiques en 6ème A.
      { data: [{ classeId: 'c1', matiereId: 'm1' }] },
      {
        data: [
          // **La ligne du collègue vient en premier, délibérément.** Une
          // première version de ce test la plaçait en second : le filtre
          // retiré, la sortie agrégeait les deux lignes, le motif affiché
          // restait celui du bon enseignant, et le test **passait alors même
          // que la fuite était réelle**. Vérifié en retirant la garde. Un test
          // qui reste vert avec le défaut réintroduit est pire que pas de test.
          note('c1', 'm2', 'BROUILLON', 'Motif du collegue', {
            classe: '6ème A',
            matiere: 'Anglais',
          }),
          note('c1', 'm1', 'BROUILLON', 'Motif qui le concerne'),
        ],
      },
    ];

    const n = await notificationsEnseignant();
    expect(n).toHaveLength(1);
    // Le motif rendu est le sien, et le décompte ne compte que ses matières.
    expect(n[0]!.detail).toContain('Motif qui le concerne');
    expect(n[0]!.titre).toContain('Mathématiques');
    expect(JSON.stringify(n)).not.toContain('collegue');
    expect(JSON.stringify(n)).not.toContain('Anglais');
  });

  it('annonce une validation et dit sur quelle fenêtre', async () => {
    reponses = [
      { data: [{ classeId: 'c1', matiereId: 'm1' }] },
      { data: [note('c1', 'm1', 'VALIDE', null)] },
    ];

    const n = await notificationsEnseignant();
    expect(n).toHaveLength(1);
    expect(n[0]!.titre).toContain('validée');
    // Sans la fenêtre annoncée, l'enseignant croit que ça vient d'arriver.
    expect(n[0]!.detail).toContain(String(JOURS_VALIDATION_RECENTE));
  });

  it('ne dit rien à qui n’a pas de fiche enseignant', async () => {
    mockGetEnseignant.mockResolvedValue(null);
    await expect(notificationsEnseignant()).resolves.toEqual([]);
  });

  it('ne dit rien à qui n’a aucune matière attribuée', async () => {
    reponses = [{ data: [] }];
    await expect(notificationsEnseignant()).resolves.toEqual([]);
  });

  it('propage une erreur de lecture au lieu de rendre une boîte vide crédible', async () => {
    reponses = [{ data: null, error: { message: 'permission denied' } }];
    await expect(notificationsEnseignant()).rejects.toMatchObject({
      message: 'permission denied',
    });
  });
});

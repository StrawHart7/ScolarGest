import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetTenantContext = vi.fn();
vi.mock('../tenant', () => ({
  getTenantContext: () => mockGetTenantContext(),
}));

function makeChain(result: { data: unknown; error: unknown; count?: number }) {
  const chain: Record<string, unknown> = {};
  const methods = ['select', 'eq', 'insert', 'update', 'upsert', 'in', 'order', 'is', 'like', 'limit'];
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

import { getDonneesBulletin } from '../bulletin-donnees';

const CTX = { userId: 'u-sec', etablissementId: 'etab1', role: 'SECRETAIRE', email: 'sec@a.com' };

const CLASSE = { id: 'classe1', niveauId: 'niveau1', serieId: null };

const PROGRAMME_ROWS = [
  {
    id: 'prog-math',
    etablissementId: 'etab1',
    niveauId: 'niveau1',
    matiereId: 'mat-math',
    obligatoire: true,
    ordreAffichage: 1,
    matiere: { id: 'mat-math', nom: 'Mathématiques', code: 'MATH' },
  },
  {
    id: 'prog-musique',
    etablissementId: 'etab1',
    niveauId: 'niveau1',
    matiereId: 'mat-musique',
    obligatoire: false,
    ordreAffichage: 2,
    matiere: { id: 'mat-musique', nom: 'Musique', code: 'MUS' },
  },
];

// Le classement passe désormais par `getResultatsClasse`, qui lit l'élève
// joint à l'inscription (une seule requête au lieu d'une par élève).
const INSCRIPTIONS = [
  { eleveId: 'eleve1', eleve: { id: 'eleve1', matricule: 'M-001', nom: 'Un', prenoms: 'Eleve' } },
  { eleveId: 'eleve2', eleve: { id: 'eleve2', matricule: 'M-002', nom: 'Deux', prenoms: 'Eleve' } },
  { eleveId: 'eleve3', eleve: { id: 'eleve3', matricule: 'M-003', nom: 'Trois', prenoms: 'Eleve' } },
];

const AFFECTATIONS = [
  {
    id: 'aff1',
    etablissementId: 'etab1',
    anneeScolaireId: 'annee1',
    enseignantId: 'ens1',
    classeId: 'classe1',
    matiereId: 'mat-math',
    createdAt: '2024-01-01',
    matiere: { nom: 'Mathématiques' },
    enseignant: { nom: 'Kone', prenoms: 'Awa' },
  },
];

/**
 * Cablage des mocks Supabase communs à tous les scénarios. L'ordre des appels
 * `.from()` dans getDonneesBulletin est: classe, inscription, [programme
 * interne], [affectations interne], evaluation, note, [classement interne
 * -> inscription + N x getMoyennesEleve internes], [moyenne annuelle: 3x
 * getMoyennesEleve]. On mocke par nom de table plutôt que par ordre pour
 * rester robuste aux appels imbriqués des services réutilisés.
 */
function wireSupabase(opts: {
  evaluations: Array<{ id: string; matiereId: string; type: string }>;
  notes: Array<{ evaluationId: string; eleveId: string; valeur: number | null; statut: string }>;
  programme?: typeof PROGRAMME_ROWS;
  inscriptions?: typeof INSCRIPTIONS;
  affectations?: typeof AFFECTATIONS;
}) {
  const programme = opts.programme ?? PROGRAMME_ROWS;
  const inscriptions = opts.inscriptions ?? INSCRIPTIONS;
  const affectations = opts.affectations ?? AFFECTATIONS;

  mockFrom.mockImplementation((table: string) => {
    switch (table) {
      case 'classe':
        return makeChain({ data: CLASSE, error: null });
      case 'inscription':
        return makeChain({ data: inscriptions, error: null });
      case 'programme_etablissement':
        return makeChain({ data: programme, error: null });
      case 'affectation_enseignant':
        return makeChain({ data: affectations, error: null });
      case 'evaluation':
        return makeChain({ data: opts.evaluations, error: null });
      case 'note':
        return makeChain({ data: opts.notes, error: null });
      default:
        return makeChain({ data: null, error: null });
    }
  });
}

describe('getDonneesBulletin', () => {
  beforeEach(() => {
    mockFrom.mockReset();
    mockGetTenantContext.mockReset();
    mockGetTenantContext.mockResolvedValue(CTX);
  });

  it('cas de base: toutes composantes présentes pour eleve1', async () => {
    const evaluations = [
      { id: 'ev-math-i1', matiereId: 'mat-math', type: 'INTERROGATION' },
      { id: 'ev-math-i2', matiereId: 'mat-math', type: 'INTERROGATION' },
      { id: 'ev-math-dev', matiereId: 'mat-math', type: 'DEVOIR' },
      { id: 'ev-math-comp', matiereId: 'mat-math', type: 'COMPOSITION' },
    ];
    const notes = [
      { evaluationId: 'ev-math-i1', eleveId: 'eleve1', valeur: 14, statut: 'VALIDE' },
      { evaluationId: 'ev-math-i2', eleveId: 'eleve1', valeur: 16, statut: 'VALIDE' },
      { evaluationId: 'ev-math-dev', eleveId: 'eleve1', valeur: 12, statut: 'VALIDE' },
      { evaluationId: 'ev-math-comp', eleveId: 'eleve1', valeur: 18, statut: 'VALIDE' },
      { evaluationId: 'ev-math-i1', eleveId: 'eleve2', valeur: 10, statut: 'VALIDE' },
    ];
    wireSupabase({ evaluations, notes, programme: [PROGRAMME_ROWS[0]!] });

    const result = await getDonneesBulletin('eleve1', 'classe1', 'TRIMESTRE_1', 'annee1');

    const math = result.matieres.find((m) => m.matiereId === 'mat-math')!;
    expect(math.moyInterros).toBe(15); // (14+16)/2
    expect(math.devoir).toBe(12);
    expect(math.moyClasse).toBe(13.5); // (15+12)/2
    expect(math.composition).toBe(18);
    expect(math.moyenneFinale).toBe(15.75); // (13.5+18)/2
    expect(math.professeurs).toBe('Awa Kone');
    expect(result.synthese.effectifClasse).toBe(3);
  });

  it('0 interro: moyInterros null, moyClasse basée uniquement sur le devoir', async () => {
    const evaluations = [{ id: 'ev-math-dev', matiereId: 'mat-math', type: 'DEVOIR' }];
    const notes = [{ evaluationId: 'ev-math-dev', eleveId: 'eleve1', valeur: 10, statut: 'VALIDE' }];
    wireSupabase({ evaluations, notes, programme: [PROGRAMME_ROWS[0]!] });

    const result = await getDonneesBulletin('eleve1', 'classe1', 'TRIMESTRE_1', 'annee1');
    const math = result.matieres[0]!;
    expect(math.moyInterros).toBeNull();
    expect(math.devoir).toBe(10);
    expect(math.moyClasse).toBe(10);
  });

  it('matière facultative sans note: moyenne null, exclue de la moyenne trimestrielle', async () => {
    wireSupabase({ evaluations: [], notes: [] });

    const result = await getDonneesBulletin('eleve1', 'classe1', 'TRIMESTRE_1', 'annee1');
    const musique = result.matieres.find((m) => m.matiereId === 'mat-musique')!;
    expect(musique.obligatoire).toBe(false);
    expect(musique.moyenneFinale).toBeNull();
    expect(musique.rangMatiere).toBeNull();
  });

  it('coefficient 0: la matière ne compte pas dans la moyenne trimestrielle (poids nul)', async () => {
    // getCoefficient renvoie null pour toute matière ici (aucune ligne coefficient_matiere
    // configurée) -> coefficient par défaut 0 dans le service.
    const evaluations = [{ id: 'ev-math-dev', matiereId: 'mat-math', type: 'DEVOIR' }];
    const notes = [{ evaluationId: 'ev-math-dev', eleveId: 'eleve1', valeur: 5, statut: 'VALIDE' }];
    wireSupabase({ evaluations, notes, programme: [PROGRAMME_ROWS[0]!] });

    const result = await getDonneesBulletin('eleve1', 'classe1', 'TRIMESTRE_1', 'annee1');
    expect(result.matieres[0]!.coefficient).toBe(0);
    // coefficient 0 -> exclue du calcul -> pas de coefficient total -> null
    expect(result.synthese.moyenneTrimestrielle).toBeNull();
  });

  it('rang matière avec égalité: classement dense (deux élèves à égalité gardent le même rang)', async () => {
    const evaluations = [{ id: 'ev-math-dev', matiereId: 'mat-math', type: 'DEVOIR' }];
    const notes = [
      { evaluationId: 'ev-math-dev', eleveId: 'eleve1', valeur: 15, statut: 'VALIDE' },
      { evaluationId: 'ev-math-dev', eleveId: 'eleve2', valeur: 15, statut: 'VALIDE' },
      { evaluationId: 'ev-math-dev', eleveId: 'eleve3', valeur: 10, statut: 'VALIDE' },
    ];
    wireSupabase({ evaluations, notes, programme: [PROGRAMME_ROWS[0]!] });

    const result = await getDonneesBulletin('eleve1', 'classe1', 'TRIMESTRE_1', 'annee1');
    // eleve1 et eleve2 sont à égalité en tête -> rang 1 tous les deux (dense, pas de saut)
    expect(result.matieres[0]!.rangMatiere).toBe(1);
  });
});

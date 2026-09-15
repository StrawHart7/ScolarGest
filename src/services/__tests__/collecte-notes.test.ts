import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Ce qui est éprouvé ici, c'est la **dérivation**, pas la requête.
 *
 * Les trois états — rien, commencé, rendu — se déduisent de deux ensembles de
 * couples classe × matière. C'est la partie qui peut se tromper en silence :
 * une erreur y afficherait au directeur qu'un enseignant n'a rien rendu alors
 * qu'il a rendu, et le coup de téléphone qui suit coûte plus cher que le bug.
 *
 * Le comportement de PostgREST lui-même — `!inner` plus filtre sur la ressource
 * embarquée plus `limit(1)` — a été vérifié par le chemin réel, contre la base
 * de Les Victorieux et contre un oracle SQL indépendant : 113 cours, 111
 * rendus, 0 commencés. Les deux ont donné le même chiffre. Ce n'est pas
 * rejouable en test unitaire, c'est pour ça que c'est écrit ici.
 */

const mockGetTenantContext = vi.fn();
vi.mock('../tenant', () => ({
  getTenantContext: () => mockGetTenantContext(),
}));

interface Appel {
  table: string;
  select: string;
  eq: Record<string, unknown>;
  in: Record<string, unknown[]>;
  count?: boolean;
}

/** Réponses successives, dans l'ordre où le service interroge la base. */
let reponses: ((appel: Appel) => { data?: unknown; count?: number; error?: unknown })[] = [];
const appels: Appel[] = [];

function constructeur(table: string) {
  const appel: Appel = { table, select: '', eq: {}, in: {} };
  const chain: Record<string, unknown> = {
    select(colonnes: string, options?: { head?: boolean; count?: string }) {
      appel.select = colonnes;
      if (options?.count) appel.count = true;
      return chain;
    },
    eq(colonne: string, valeur: unknown) {
      appel.eq[colonne] = valeur;
      return chain;
    },
    in(colonne: string, valeurs: unknown[]) {
      appel.in[colonne] = valeurs;
      return chain;
    },
    limit() {
      return chain;
    },
    then(resoudre: (v: unknown) => unknown) {
      appels.push(appel);
      const suite = reponses.shift();
      const brut = suite ? suite(appel) : { data: [] };
      return Promise.resolve({ data: brut.data ?? null, count: brut.count, error: brut.error ?? null }).then(
        resoudre,
      );
    },
  };
  return chain;
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ from: (table: string) => constructeur(table) }),
}));

import { etatCollecteNotes } from '../collecte-notes';

const affectation = (
  enseignantId: string,
  nom: string,
  classeId: string,
  classeNom: string,
  matiereId: string,
  matiereNom: string,
) => ({
  enseignantId,
  classeId,
  matiereId,
  enseignant: { nom, prenoms: 'Kossi' },
  classe: { nom: classeNom },
  matiere: { nom: matiereNom },
});

describe('etatCollecteNotes', () => {
  beforeEach(() => {
    mockGetTenantContext.mockResolvedValue({
      userId: 'u1',
      etablissementId: 'etab1',
      role: 'DIRECTEUR',
      email: 'd@e.tg',
    });
    appels.length = 0;
    reponses = [];
  });

  it('distingue rendu, commencé et rien', async () => {
    reponses = [
      () => ({
        data: [
          affectation('e1', 'ADJOVI', 'c1', '6ème A', 'm1', 'Mathématiques'),
          affectation('e1', 'ADJOVI', 'c1', '6ème A', 'm2', 'Physique'),
          affectation('e2', 'BEDIA', 'c2', '5ème B', 'm1', 'Mathématiques'),
        ],
      }),
      // rendus : seul (c2, m1)
      () => ({ data: [{ classeId: 'c2', matiereId: 'm1' }] }),
      // amorcés : (c2, m1) et (c1, m2) — ce dernier n'a que des brouillons
      () => ({
        data: [
          { classeId: 'c2', matiereId: 'm1' },
          { classeId: 'c1', matiereId: 'm2' },
        ],
      }),
    ];

    const etat = await etatCollecteNotes('annee1', 'TRIMESTRE_2');

    expect(etat.periode).toBe('TRIMESTRE_2');
    expect(etat.coursTotal).toBe(3);
    expect(etat.coursRendus).toBe(1);
    expect(etat.enseignantsTotal).toBe(2);
    expect(etat.enseignantsAJour).toBe(1);

    expect(etat.enAttente).toHaveLength(1);
    const adjovi = etat.enAttente[0]!;
    expect(adjovi.nomComplet).toBe('ADJOVI Kossi');
    expect(adjovi.rendus).toBe(0);
    expect(adjovi.total).toBe(2);
    expect(adjovi.manques.map((m) => [m.matiereNom, m.etat])).toEqual([
      ['Mathématiques', 'RIEN'],
      ['Physique', 'COMMENCE'],
    ]);
  });

  it("ne demande pas la période à la base quand l'appelant l'impose", async () => {
    reponses = [() => ({ data: [] })];
    await etatCollecteNotes('annee1', 'TRIMESTRE_3');
    // Une seule requête : les affectations. Sans elles, rien à mesurer.
    expect(appels).toHaveLength(1);
    expect(appels[0]!.table).toBe('affectation_enseignant');
  });

  it("retient la période la plus avancée qui porte des évaluations", async () => {
    reponses = [
      () => ({ data: [affectation('e1', 'ADJOVI', 'c1', '6ème A', 'm1', 'Mathématiques')] }),
      // Trois comptages, dans l'ordre des trimestres.
      () => ({ count: 12 }),
      () => ({ count: 4 }),
      () => ({ count: 0 }),
      () => ({ data: [] }),
      () => ({ data: [] }),
    ];

    const etat = await etatCollecteNotes('annee1');
    expect(etat.periode).toBe('TRIMESTRE_2');
    // Et c'est bien cette période-là qui a servi aux deux lectures de notes.
    expect(appels.at(-1)!.eq['periode']).toBe('TRIMESTRE_2');
  });

  it("retombe sur le 1er trimestre quand aucune évaluation n'existe", async () => {
    reponses = [
      () => ({ data: [affectation('e1', 'ADJOVI', 'c1', '6ème A', 'm1', 'Mathématiques')] }),
      () => ({ count: 0 }),
      () => ({ count: 0 }),
      () => ({ count: 0 }),
      () => ({ data: [] }),
      () => ({ data: [] }),
    ];
    const etat = await etatCollecteNotes('annee1');
    expect(etat.periode).toBe('TRIMESTRE_1');
    expect(etat.enAttente[0]!.manques[0]!.etat).toBe('RIEN');
  });

  it('classe le plus en attente en tête, puis par ordre alphabétique', async () => {
    reponses = [
      () => ({
        data: [
          affectation('e1', 'ZINSOU', 'c1', '6ème A', 'm1', 'Mathématiques'),
          affectation('e2', 'AKAKPO', 'c2', '5ème B', 'm1', 'Mathématiques'),
          affectation('e3', 'MENSAH', 'c3', '4ème C', 'm1', 'Mathématiques'),
          affectation('e3', 'MENSAH', 'c3', '4ème C', 'm2', 'Physique'),
        ],
      }),
      () => ({ data: [] }),
      () => ({ data: [] }),
    ];

    const etat = await etatCollecteNotes('annee1', 'TRIMESTRE_1');
    expect(etat.enAttente.map((e) => e.nomComplet)).toEqual([
      'MENSAH Kossi', // deux matières
      'AKAKPO Kossi', // une, et A avant Z
      'ZINSOU Kossi',
    ]);
  });

  it('lève plutôt que de sous-déclarer quand le plafond de lecture est atteint', async () => {
    const trop = Array.from({ length: 3000 }, (_, i) => ({
      classeId: `c${i}`,
      matiereId: 'm1',
    }));
    reponses = [
      () => ({ data: [affectation('e1', 'ADJOVI', 'c1', '6ème A', 'm1', 'Mathématiques')] }),
      () => ({ data: trop }),
    ];

    // Une lecture tronquée transformerait des notes rendues en absences.
    await expect(etatCollecteNotes('annee1', 'TRIMESTRE_1')).rejects.toThrow(
      "Trop d'évaluations",
    );
  });

  it("ne lit rien de plus quand l'école n'a aucune matière attribuée", async () => {
    reponses = [() => ({ data: [] })];
    const etat = await etatCollecteNotes('annee1');
    expect(etat).toMatchObject({ coursTotal: 0, enseignantsTotal: 0, enAttente: [] });
    expect(appels).toHaveLength(1);
  });

  it('propage une erreur de lecture au lieu de rendre une liste vide crédible', async () => {
    reponses = [() => ({ data: null, error: { message: 'permission denied' } })];
    await expect(etatCollecteNotes('annee1', 'TRIMESTRE_1')).rejects.toMatchObject({
      message: 'permission denied',
    });
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * La base est simulee plutot que reelle : `fake-indexeddb` serait une
 * dependance de plus, et les worktrees partagent leurs `node_modules`. Ce
 * qu'on veut verrouiller ici n'est pas IndexedDB, c'est l'ordonnancement de la
 * file — ordre d'arrivee, recul, isolement des echecs.
 */
type Ligne = { cle: string; userId: string; [k: string]: unknown };
const magasin = new Map<string, Ligne>();

vi.mock('../db', () => ({
  ouvrirBase: async () => ({
    get: async (_m: string, cle: string) => magasin.get(cle),
    put: async (_m: string, valeur: Ligne) => void magasin.set(valeur.cle, valeur),
    delete: async (_m: string, cle: string) => void magasin.delete(cle),
    getAllFromIndex: async (_m: string, _i: string, userId: string) =>
      [...magasin.values()].filter((o) => o.userId === userId),
    count: async () => magasin.size,
  }),
}));

const {
  enfiler,
  listerFile,
  viderFile,
  reculMs,
  messageErreur,
  retirerDeLaFile,
  TENTATIVES_AVANT_ABANDON,
} = await import('../file-attente');

const base = { userId: 'u1', etablissementId: 'e1', intitule: 'test' } as const;

beforeEach(() => magasin.clear());

describe('file d’attente hors ligne', () => {
  it('envoie dans l’ordre d’arrivée', async () => {
    // Une soumission d'evaluation posterieure a une saisie doit partir apres
    // elle : l'inverse verrouille l'evaluation avant la derniere note.
    await enfiler({ ...base, type: 'SAISIE_NOTE', charge: { n: 1 }, cle: 'a' });
    await new Promise((r) => setTimeout(r, 2));
    await enfiler({ ...base, type: 'SOUMISSION_NOTES', charge: { n: 2 }, cle: 'b' });

    const vus: string[] = [];
    const bilan = await viderFile('u1', {
      SAISIE_NOTE: async () => void vus.push('saisie'),
      SOUMISSION_NOTES: async () => void vus.push('soumission'),
    });

    expect(vus).toEqual(['saisie', 'soumission']);
    expect(bilan.envoyees).toBe(2);
    expect(await listerFile('u1')).toHaveLength(0);
  });

  it('n’arrête pas la file sur un échec', async () => {
    // Bloquer sur la premiere ligne fautive ferait perdre une journee entiere
    // de saisie.
    await enfiler({ ...base, type: 'SAISIE_NOTE', charge: {}, cle: 'ko' });
    await new Promise((r) => setTimeout(r, 2));
    await enfiler({ ...base, type: 'PAIEMENT', charge: {}, cle: 'ok' });

    const bilan = await viderFile('u1', {
      SAISIE_NOTE: async () => {
        throw { message: 'refus RLS', code: '42501' };
      },
      PAIEMENT: async () => {},
    });

    expect(bilan).toEqual({ envoyees: 1, echouees: 1, reportees: 0 });
    const restantes = await listerFile('u1');
    expect(restantes.map((o) => o.cle)).toEqual(['ko']);
    expect(restantes[0]?.dernierEchec).toContain('refus RLS');
  });

  it('recule après un échec au lieu de marteler', async () => {
    await enfiler({ ...base, type: 'SAISIE_NOTE', charge: {}, cle: 'x' });
    const echouer = { SAISIE_NOTE: async () => Promise.reject(new Error('reseau')) };

    await viderFile('u1', echouer, 1_000);
    expect((await listerFile('u1'))[0]?.prochaineTentative).toBe(1_000 + reculMs(1));

    // Rappelee avant l'echeance : reportee sans nouvelle tentative.
    let appels = 0;
    const bilan = await viderFile(
      'u1',
      { SAISIE_NOTE: async () => void (appels += 1) },
      1_001,
    );
    expect(appels).toBe(0);
    expect(bilan.reportees).toBe(1);
  });

  it('ne supprime jamais une opération épuisée', async () => {
    // Perdre silencieusement un encaissement serait pire que de le laisser en
    // attente visible.
    await enfiler({ ...base, type: 'PAIEMENT', charge: {}, cle: 'p' });
    magasin.set('p', { ...(magasin.get('p') as Ligne), tentatives: TENTATIVES_AVANT_ABANDON });

    const bilan = await viderFile('u1', { PAIEMENT: async () => {} }, Date.now() + 1e9);
    expect(bilan).toEqual({ envoyees: 0, echouees: 0, reportees: 1 });
    expect(await listerFile('u1')).toHaveLength(1);
  });

  it('conserve une opération dont le type est inconnu de ce client', async () => {
    // Deposee par une version plus recente, apres mise a jour differee.
    await enfiler({ ...base, type: 'PAIEMENT', charge: {}, cle: 'futur' });
    const bilan = await viderFile('u1', {});
    expect(bilan.reportees).toBe(1);
    expect(await listerFile('u1')).toHaveLength(1);
  });

  it('ne remet pas en fin de file une opération déjà présente', async () => {
    await enfiler({ ...base, type: 'SAISIE_NOTE', charge: { v: 1 }, cle: 'k' });
    magasin.set('k', { ...(magasin.get('k') as Ligne), tentatives: 3, creeLe: 42 });

    await enfiler({ ...base, type: 'SAISIE_NOTE', charge: { v: 2 }, cle: 'k' });
    const [op] = await listerFile('u1');
    expect(op?.creeLe).toBe(42);
    expect(op?.tentatives).toBe(3);
    expect(op?.charge).toEqual({ v: 2 });
  });

  it('n’isole que l’utilisateur demandé', async () => {
    await enfiler({ ...base, type: 'SAISIE_NOTE', charge: {}, cle: 'mien' });
    await enfiler({ ...base, userId: 'autre', type: 'SAISIE_NOTE', charge: {}, cle: 'sien' });
    expect((await listerFile('u1')).map((o) => o.cle)).toEqual(['mien']);
  });

  it('retire de la file sans lever', async () => {
    await enfiler({ ...base, type: 'SAISIE_NOTE', charge: {}, cle: 'z' });
    await retirerDeLaFile('z');
    expect(await listerFile('u1')).toHaveLength(0);
  });
});

describe('messageErreur', () => {
  it('lit une erreur Supabase, qui n’est pas une Error', () => {
    // `e instanceof Error` est toujours faux sur ces objets : le motif reel
    // serait remplace par un message generique.
    expect(messageErreur({ message: 'doublon', details: 'cle (a,b)' })).toBe(
      'doublon — cle (a,b)',
    );
    expect(messageErreur({ code: '23505' })).toBe('Code 23505');
    expect(messageErreur(new Error('classique'))).toBe('classique');
    expect(messageErreur(undefined)).toBe('Erreur inconnue');
  });
});

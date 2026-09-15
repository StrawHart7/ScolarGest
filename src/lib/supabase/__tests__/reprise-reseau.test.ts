import { describe, it, expect, vi } from 'vitest';
import { creerFetchResilient, CODES_REPRIS } from '../reprise-reseau';

/** Aucune attente réelle : le test mesure le nombre d'appels, pas le temps. */
const sansAttente = () => Promise.resolve();

/** Sert les réponses données, dans l'ordre, et compte les appels. */
function fetchScripte(...reponses: Response[]) {
  const appels: Array<{ methode: string }> = [];
  const faux = vi.fn(async (_entree: RequestInfo | URL, init?: RequestInit) => {
    appels.push({ methode: (init?.method ?? 'GET').toUpperCase() });
    const suivante = reponses[Math.min(appels.length - 1, reponses.length - 1)];
    return suivante!.clone();
  });
  return { faux: faux as unknown as typeof fetch, appels };
}

const vide = (statut: number) => new Response(null, { status: statut, statusText: 'Bad Gateway' });
const ok = () => new Response('[]', { status: 200 });

describe('reprise des lectures transitoires', () => {
  it('rejoue un comptage HEAD tombé en 502 et rend la réponse qui aboutit', async () => {
    const { faux, appels } = fetchScripte(vide(502), ok());
    const resilient = creerFetchResilient(faux, sansAttente);

    const reponse = await resilient('https://exemple.test/rest/v1/classe', { method: 'HEAD' });

    expect(reponse.status).toBe(200);
    expect(appels).toHaveLength(2);
  });

  it.each(CODES_REPRIS)('reprend le code %i, que postgrest-js laisse passer', async (statut) => {
    const { faux, appels } = fetchScripte(vide(statut), ok());
    const resilient = creerFetchResilient(faux, sansAttente);

    await resilient('https://exemple.test/rest/v1/eleve', { method: 'GET' });

    expect(appels).toHaveLength(2);
  });

  it('ne reprend pas 503, déjà repris par postgrest-js — sinon les deux se multiplient', async () => {
    const { faux, appels } = fetchScripte(vide(503));
    const resilient = creerFetchResilient(faux, sansAttente);

    await resilient('https://exemple.test/rest/v1/eleve', { method: 'GET' });

    expect(appels).toHaveLength(1);
  });

  it('ne rejoue jamais une écriture : un versement rejoué encaisse deux fois', async () => {
    const { faux, appels } = fetchScripte(vide(502));
    const resilient = creerFetchResilient(faux, sansAttente);

    await resilient('https://exemple.test/rest/v1/paiement', { method: 'POST' });

    expect(appels).toHaveLength(1);
  });

  it('s’arrête après une seule reprise, comme `reessayerLecture`', async () => {
    // Marteler ne répare pas une base en panne : le deuxième échec est une
    // information. La règle vient de `src/lib/reessayer.ts` ; la répéter ici
    // évite que les deux doctrines de reprise divergent sans arbitre.
    const { faux, appels } = fetchScripte(vide(502));
    const resilient = creerFetchResilient(faux, sansAttente);

    await resilient('https://exemple.test/rest/v1/classe', { method: 'HEAD' });

    expect(appels).toHaveLength(2);
  });
});

describe('explicitation des réponses muettes', () => {
  /**
   * Le cœur de l'incident du 2026-09-15.
   *
   * Sans corps, `postgrest-js` rend `{ message: '' }` ; Next hache
   * `message + stack`, donc la chaîne vide, et affiche la graine de son
   * algorithme : **5381**. La même référence pour toutes les pannes de la
   * famille, donc introuvable dans un journal.
   *
   * Ce que le test verrouille n'est pas la reprise mais la **lisibilité** :
   * après épuisement, le corps doit porter une phrase et un code.
   */
  it('donne un message et un code à une erreur au corps vide', async () => {
    const { faux } = fetchScripte(vide(502));
    const resilient = creerFetchResilient(faux, sansAttente);

    const reponse = await resilient('https://exemple.test/rest/v1/classe', { method: 'HEAD' });
    const corps = JSON.parse(await reponse.text());

    expect(reponse.status).toBe(502);
    expect(corps.message).not.toBe('');
    expect(corps.message).toMatch(/n’a pas répondu/);
    expect(corps.code).toBe('SG_HTTP_502');
  });

  it('laisse intact un 404 au corps vide : postgrest-js y lit « aucune ligne »', async () => {
    // Le réécrire ferait échouer `maybeSingle()` sur toute absence — c'est-à-dire
    // sur un cas parfaitement normal.
    const { faux } = fetchScripte(new Response(null, { status: 404 }));
    const resilient = creerFetchResilient(faux, sansAttente);

    const reponse = await resilient('https://exemple.test/rest/v1/eleve', { method: 'GET' });

    expect(reponse.status).toBe(404);
    expect(await reponse.text()).toBe('');
  });

  it('rend le message d’origine quand la base en donne un', async () => {
    const attendu = { message: 'permission denied for table note', code: '42501' };
    const { faux } = fetchScripte(
      new Response(JSON.stringify(attendu), { status: 403, headers: { 'content-length': '999' } }),
    );
    const resilient = creerFetchResilient(faux, sansAttente);

    const reponse = await resilient('https://exemple.test/rest/v1/note', { method: 'GET' });

    expect(JSON.parse(await reponse.text())).toEqual(attendu);
    // `content-length` décrivait le corps d'origine : le recopier annoncerait
    // une longueur fausse sur un corps réémis.
    expect(reponse.headers.get('content-length')).toBeNull();
  });

  it('laisse passer un succès sans y toucher', async () => {
    const { faux } = fetchScripte(new Response('[{"id":1}]', { status: 200 }));
    const resilient = creerFetchResilient(faux, sansAttente);

    const reponse = await resilient('https://exemple.test/rest/v1/eleve', { method: 'GET' });

    expect(await reponse.text()).toBe('[{"id":1}]');
  });

  it('ne construit pas de corps sur un 204, que la norme interdit d’en porter', async () => {
    const { faux } = fetchScripte(new Response(null, { status: 204 }));
    const resilient = creerFetchResilient(faux, sansAttente);

    const reponse = await resilient('https://exemple.test/rest/v1/eleve', { method: 'GET' });

    expect(reponse.status).toBe(204);
  });
});

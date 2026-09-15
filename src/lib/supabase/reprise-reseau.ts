/**
 * Reprise des lectures et explicitation des réponses muettes de PostgREST.
 *
 * Module sans dépendance — ni `next/headers`, ni client Supabase — pour être
 * éprouvable sans monter Next, et importable des deux côtés de la frontière.
 *
 * ## L'incident qui l'a fait écrire
 *
 * Le 2026-09-13 puis le 2026-09-15, `/dashboard` a affiché « Une erreur est
 * survenue — Référence 5381 », deux jours et deux compilations d'écart, puis
 * s'est chargée normalement au clic sur « Réessayer ».
 *
 * **5381 n'est pas un identifiant de panne.** C'est la graine de l'algorithme
 * de hachage de Next (`next/dist/compiled/string-hash`) : `hash('')` vaut
 * exactement 5381. Next calcule le digest sur `err.message + err.stack` ; le
 * digest 5381 signifie donc que ce qui a été levé n'a **ni message ni pile**.
 * Toute panne de cette famille, sur n'importe quelle page, portera la même
 * référence — la chercher dans un journal ne mène nulle part.
 *
 * ## Pourquoi un objet sans message
 *
 * Trois faits de la bibliothèque, qui s'emboîtent :
 *
 * 1. `select('id', { count: 'exact', head: true })` émet une requête **HEAD**
 *    (`PostgrestQueryBuilder.ts`). Une réponse HEAD ne porte jamais de corps,
 *    par la norme HTTP. Or le socle de configuration, le diagnostic des
 *    conseils et la progression du démarrage ne sont faits **que** de
 *    comptages de ce genre.
 * 2. Devant une réponse en erreur au corps vide, `postgrest-js` retombe sur
 *    `error = { message: body }` — un objet nu, sans `stack`
 *    (`PostgrestBuilder.ts`). Avec un corps vide, le message est la chaîne
 *    vide.
 * 3. Nos services propagent tels quels (`if (error) throw error`), comme le
 *    veut le dépôt. Next hache `'' + ''` et rend 5381.
 *
 * ## Les deux gestes posés ici
 *
 * **Rejouer.** `postgrest-js` ne reprend que les codes **503 et 520** ; un
 * 500, un 502 ou un 504 — une passerelle qui bronche, un pool saturé, un
 * démarrage à froid — passe directement en erreur. On les reprend donc, et
 * eux seuls : reprendre aussi 503 et 520 multiplierait les deux mécanismes
 * l'un par l'autre, jusqu'à neuf appels pour une page qui en fait déjà vingt.
 *
 * Le 504 n'est pas une hypothèse : `src/lib/reessayer.ts` le mesure depuis le
 * 2026-09-13 sur les journaux de la base — « une à quatre réponses 504 par
 * heure, à toute heure, y compris la nuit », sur des lectures triviales. La
 * parade y était posée **appel par appel**, et seulement dans le middleware.
 * Une page de tableau de bord en fait une vingtaine, donc une vingtaine de
 * chances de tirer la mauvaise, toutes à découvert.
 *
 * **Expliciter.** Si la reprise échoue, on donne un corps à la réponse muette
 * pour que l'erreur remontée porte enfin une phrase et un code. C'est le seul
 * moyen de corriger les quelque cent `if (error) throw error` d'un coup, sans
 * les toucher.
 *
 * ## Deux bornes qui ne sont pas des détails
 *
 * **Seules les méthodes idempotentes sont rejouées.** Doctrine constante du
 * dépôt : « un versement rejoué encaisse deux fois ». Un POST qui n'a pas
 * répondu a très bien pu s'appliquer — c'est à la file d'attente hors ligne et
 * à `executerUneSeuleFois` de trancher, pas à une couche réseau.
 *
 * **Un 404 au corps vide n'est jamais réécrit.** `postgrest-js` s'en sert pour
 * reconnaître « aucune ligne » et le convertir en 204 ; lui inventer un
 * message ferait échouer `maybeSingle()` sur toute absence — c'est-à-dire sur
 * un cas parfaitement normal.
 */

/** Codes que `postgrest-js` ne reprend pas, et qui sont pourtant transitoires. */
export const CODES_REPRIS = [500, 502, 504] as const;

/** Rejouables parce que sans effet de bord. Voir la doctrine ci-dessus. */
export const METHODES_REJOUABLES = ['GET', 'HEAD', 'OPTIONS'] as const;

/**
 * **Une seule reprise, et 120 ms** — les valeurs de `src/lib/reessayer.ts`.
 *
 * Ce module-là existait avant celui-ci et porte la décision : « si la base est
 * réellement en panne, marteler ne la répare pas et retarde l'aveu ; le
 * deuxième échec est une information, pas un cas à réessayer ». Elle vaut
 * toujours, et en prendre une autre ici ferait cohabiter deux doctrines de
 * reprise dans le même produit sans que rien ne les départage.
 *
 * Ce qui change n'est donc pas la règle mais sa **portée** : `reessayerLecture`
 * s'emploie appel par appel et n'a jamais été posée que dans le middleware ;
 * celle-ci vit sous le client, donc sous les quelque vingt lectures d'une page
 * de tableau de bord — qui étaient précisément les non-couvertes.
 */
const ATTENTES_MS = [120];

function estRejouable(methode: string): boolean {
  return (METHODES_REJOUABLES as readonly string[]).includes(methode);
}

function estRepris(statut: number): boolean {
  return (CODES_REPRIS as readonly number[]).includes(statut);
}

/**
 * Redonne un corps lisible à une réponse en erreur qui n'en a pas.
 *
 * Le corps est relu puis réémis à l'identique quand il existe : lire un flux
 * le consomme, et rendre la réponse d'origine ferait échouer la lecture
 * suivante avec « body already read » — une panne qu'on aurait fabriquée en
 * voulant en diagnostiquer une autre.
 */
async function expliciter(reponse: Response): Promise<Response> {
  // `< 400` couvre aussi 204 et 304, dont le constructeur de `Response`
  // refuse qu'ils portent un corps.
  if (reponse.status < 400 || reponse.status === 404) return reponse;

  const corps = await reponse.text();

  // `content-length` et `content-encoding` décrivent le corps d'origine : les
  // recopier au-dessus d'un corps réécrit annoncerait une longueur fausse.
  const entetes = new Headers();
  reponse.headers.forEach((valeur, nom) => {
    const cle = nom.toLowerCase();
    if (cle === 'content-length' || cle === 'content-encoding') return;
    entetes.set(nom, valeur);
  });

  if (corps !== '') {
    return new Response(corps, {
      status: reponse.status,
      statusText: reponse.statusText,
      headers: entetes,
    });
  }

  entetes.set('content-type', 'application/json; charset=utf-8');
  return new Response(
    JSON.stringify({
      message: `Le serveur de données n’a pas répondu (erreur HTTP ${reponse.status}). Réessayez dans un instant.`,
      details:
        'Réponse sans corps renvoyée par PostgREST. Sur une requête de comptage (HEAD), la norme HTTP interdit tout corps : la cause exacte est à chercher dans les journaux Supabase, à cet horodatage.',
      hint: '',
      code: `SG_HTTP_${reponse.status}`,
    }),
    { status: reponse.status, statusText: reponse.statusText, headers: entetes },
  );
}

/**
 * Enveloppe un `fetch` : reprise des lectures transitoires, puis explicitation.
 *
 * `fetchBase` et `attendre` sont injectables pour que le test éprouve le vrai
 * comportement — combien d'appels, dans quel ordre — sans réseau ni minuteur.
 */
export function creerFetchResilient(
  fetchBase: typeof fetch,
  attendre: (ms: number) => Promise<void> = (ms) =>
    new Promise((resoudre) => setTimeout(resoudre, ms)),
): typeof fetch {
  return async (entree: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const methode = (init?.method ?? 'GET').toUpperCase();

    // Un `Request` porte un flux de corps qui ne se relit pas : le rejouer
    // enverrait une requête vide. Les clients Supabase passent une URL et un
    // `init`, donc le cas normal reste couvert ; celui-ci n'est qu'un garde-fou.
    const rejouable = estRejouable(methode) && !(entree instanceof Request);

    let reponse = await fetchBase(entree, init);

    for (let essai = 0; rejouable && essai < ATTENTES_MS.length; essai += 1) {
      if (!estRepris(reponse.status)) break;
      await attendre(ATTENTES_MS[essai]!);
      reponse = await fetchBase(entree, init);
    }

    return expliciter(reponse);
  };
}

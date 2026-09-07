/*
 * Service worker ScolarGest.
 *
 * Rôle : rendre l'application installable, et la rendre consultable pendant
 * une coupure.
 *
 * **Ce fichier ne mettait aucune page en cache.** Le handler `fetch` prévoyait
 * pourtant de servir `caches.match(request)` quand le réseau échoue — mais
 * rien n'y déposait jamais de navigation, donc ce repli ne tombait jamais et
 * toute coupure menait à `/offline`. Le cache de pages ci-dessous ferme cet
 * écart.
 *
 * **C'est un changement de posture, décidé par l'utilisateur le 2026-09-07.**
 * Les pages authentifiées contiennent des données d'établissement, y compris
 * financières, et elles sont désormais écrites sur l'appareil. La contrepartie
 * est la purge à la déconnexion (message `PURGER_PAGES` ci-dessous), sans
 * laquelle un poste partagé exposerait l'école au compte suivant.
 *
 * Bump CACHE_VERSION à chaque changement de cette liste ou de la stratégie :
 * l'ancien cache est purgé à l'activation.
 */
const CACHE_VERSION = 'scolargest-v6';

// Cache des pages consultees, separe de la coquille statique : il contient des
// donnees d'etablissement et doit pouvoir etre purge seul, a la deconnexion,
// sans reinstaller les icones et la page /offline.
const CACHE_PAGES = 'scolargest-pages-v1';

// Ressources statiques sûres à précacher (pas de page authentifiée ici).
// /offline est la page de secours affichée quand une navigation échoue et
// qu'aucune version en cache de la page visée n'existe (voir le handler
// `fetch` plus bas) — elle ne dépend d'aucune donnée ni de l'auth.
const PRECACHE_URLS = [
  '/manifest.webmanifest',
  '/assets/icons/android-chrome-192x192.png',
  '/assets/icons/android-chrome-512x512.png',
  '/assets/icons/favicon-32x32.png',
  '/offline',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      // `addAll` est ATOMIQUE : une seule URL en echec fait rejeter tout le
      // lot, l'installation echoue, et **rien** n'est mis en cache — pas meme
      // /offline. Constate sur une preview Vercel protegee, ou le manifeste
      // revient en 401 : la page de secours n'existait donc pas, et une
      // navigation hors ligne tombait sur l'ecran d'erreur du navigateur.
      //
      // On met donc en cache une URL a la fois, et un echec isole ne prive
      // pas l'utilisateur des autres.
      .then((cache) =>
        Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url))),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            // Le cache de pages survit a un changement de CACHE_VERSION : le
            // purger a chaque deploiement priverait de consultation une ecole
            // qui n'a pas de reseau au moment de la mise a jour.
            .filter((key) => key !== CACHE_VERSION && key !== CACHE_PAGES)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/**
 * Page de secours d'une navigation hors ligne. **Rend toujours une reponse.**
 *
 * `caches.match('/offline')` peut resoudre sur `undefined` — page jamais mise
 * en cache, precache echoue, cache purge par le navigateur sous pression
 * disque. Or `respondWith(undefined)` se traduit par une erreur reseau, et
 * l'utilisateur voit l'ecran gris « Ce site est inaccessible » au lieu du
 * message qu'on avait ecrit pour lui. C'est arrive en preview le 2026-09-07.
 *
 * Le dernier recours est donc une page fabriquee ici, sans dependance : elle
 * n'a besoin ni du reseau, ni du cache, ni de l'application.
 */
async function reponseDeSecours() {
  const page = await caches.match('/offline');
  if (page) return page;

  // Tentative opportuniste : le reseau est peut-etre revenu depuis.
  try {
    const fraiche = await fetch('/offline');
    if (fraiche && fraiche.ok) {
      const copie = fraiche.clone();
      caches.open(CACHE_VERSION).then((cache) => cache.put('/offline', copie));
      return fraiche;
    }
  } catch {
    // Toujours hors ligne.
  }

  return new Response(
    `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Hors connexion</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
       background:#f6f7f9;color:#12213a;
       font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
  main{max-width:32rem;padding:2rem;text-align:center}
  h1{font-size:1.5rem;margin:0 0 .75rem}
  p{margin:0 0 1rem;line-height:1.6;color:#4a5568}
  button{font:inherit;padding:.6rem 1.25rem;border:0;border-radius:.75rem;
         background:#1b4dd8;color:#fff;cursor:pointer}
</style></head><body><main>
<h1>Page non disponible hors connexion</h1>
<p>Cette page n'a pas encore ete consultee sur cet appareil, elle ne peut donc pas
etre affichee sans reseau. Les pages deja ouvertes restent accessibles.</p>
<p>Vos saisies en attente sont conservees et partiront des le retour de la connexion.</p>
<button onclick="location.reload()">Reessayer</button>
</main></body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // On ne touche qu'aux GET same-origin. Les POST/Server Actions, Supabase et
  // toute requête cross-origin passent directement au réseau.
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  // Navigations (pages HTML) : réseau d'abord, page déjà visitée en cache en
  // second recours, page de secours /offline en dernier recours (jamais le
  // manifeste JSON brut, illisible pour un humain).
  // Navigations et charges RSC : reseau d'abord, et on garde une copie.
  //
  // `redirected` est ecarte : le middleware renvoie une redirection vers
  // /login quand la session expire, et mettre cette reponse en cache sous
  // l'URL demandee servirait une page de connexion a la place du tableau de
  // bord, hors ligne, pour toujours.
  const estRsc =
    request.headers.get('RSC') === '1' ||
    (request.headers.get('accept') || '').includes('text/x-component');

  if (request.mode === 'navigate' || estRsc) {
    event.respondWith(
      fetch(request)
        .then((reponse) => {
          if (reponse.ok && !reponse.redirected && reponse.type === 'basic') {
            const copie = reponse.clone();
            caches.open(CACHE_PAGES).then((cache) => cache.put(request, copie));
          }
          return reponse;
        })
        .catch(async () => {
          const enCache = await caches.match(request);
          if (enCache) return enCache;
          if (request.mode !== 'navigate') return Response.error();
          return reponseDeSecours();
        }),
    );
    return;
  }

  // Assets statiques Next et icônes : cache d'abord, réseau en secours, et on
  // met en cache la réponse réseau pour la prochaine fois.
  const url = new URL(request.url);
  // Le manifeste et le favicon sont precaches mais n'etaient intercepes par
  // aucune branche : ni `/_next/static/`, ni `/assets/`. Ils partaient donc au
  // reseau et echouaient hors ligne, alors que leur copie etait a portee de
  // main. Visible dans l'onglet Reseau : `manifest.webmanifest` en echec sur
  // une page par ailleurs servie depuis le cache.
  const isStaticAsset =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/assets/') ||
    url.pathname === '/manifest.webmanifest' ||
    url.pathname === '/favicon.ico';

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
            return response;
          }),
      ),
    );
  }
});


/**
 * Purge du cache de pages, demandee par l'application a la deconnexion.
 *
 * Elle passe par un message et non par `caches.delete` cote page : les deux
 * fonctionnent, mais le service worker est le seul a savoir sous quel nom il
 * range ses caches. Laisser la page deviner ce nom en ferait deux sources de
 * verite, et la premiere renommage silencieux laisserait des donnees d'ecole
 * derriere.
 */
/**
 * Met en cache une liste de pages, par petits paquets.
 *
 * Sequencer compte autant que precharger. Lancer trente requetes d'un coup sur
 * une connexion mobile togolaise sature le lien et ralentit la page que
 * l'utilisateur regarde — on aurait degrade le present pour preparer un futur
 * hypothetique. Quatre a la fois laisse passer le reste.
 */
async function precharger(urls) {
  const cache = await caches.open(CACHE_PAGES);
  const cacheStatique = await caches.open(CACHE_VERSION);
  const TAILLE_PAQUET = 4;

  for (let i = 0; i < urls.length; i += TAILLE_PAQUET) {
    await Promise.allSettled(
      urls.slice(i, i + TAILLE_PAQUET).map(async (url) => {
        const reponse = await fetch(url, { credentials: 'same-origin' });
        // Meme garde que sur les navigations : une redirection vers /login
        // mise en cache servirait une page de connexion pour toujours.
        if (!reponse.ok || reponse.redirected || reponse.type !== 'basic') return;

        // Lire le corps AVANT de le ranger : `cache.put` consomme le flux.
        const html = await reponse.clone().text();
        await cache.put(url, reponse);
        await mettreEnCacheRessources(html, cacheStatique);
      }),
    );
  }
}

/**
 * Met en cache les fichiers statiques qu'une page precharge reclame.
 *
 * Sans cela le prechargement produit une page **a moitie** disponible : le
 * HTML arrive du cache, React tente de s'hydrater, le morceau de code manquant
 * fait tomber la limite d'erreur, et l'utilisateur lit « Une erreur est
 * survenue » sur une page qu'on croyait preparee. C'est pire qu'une page
 * absente : on a promis puis echoue. Constate en production le 2026-09-07.
 *
 * Les fragments sont largement partages entre pages — le cache dedoublonne de
 * lui-meme, et vingt-cinq pages ne coutent pas vingt-cinq fois leur poids.
 *
 * L'extraction se fait par expression reguliere et non par un analyseur HTML :
 * `DOMParser` n'existe pas dans un service worker. On ne cherche que des
 * chemins `/_next/static/`, dont la forme est connue et close.
 */
async function mettreEnCacheRessources(html, cacheStatique) {
  const chemins = new Set();
  // Le chemin capture peut emporter un caractere d'echappement : dans les
  // donnees RSC les guillemets sont echappes. On le retire ensuite plutot
  // que de compliquer l'expression — une URL qui finit par une barre oblique
  // inverse n'existe pas, et le telechargement echouerait a chaque
  // prechargement sans que personne ne le voie.
  const motif = /["'(](\/_next\/static\/[^"')\s]+)/g;
  let trouve;
  while ((trouve = motif.exec(html)) !== null) {
    // Retire tout caractere final qui ne peut pas appartenir a un chemin :
    // dans les donnees RSC le guillemet est echappe, et la capture emporte le
    // caractere d'echappement. Une URL ainsi salie n'existe pas, et son
    // telechargement echouerait a chaque prechargement sans que rien ne le dise.
    chemins.add(trouve[1].replace(/[^A-Za-z0-9._/-]+$/, ''));
  }

  const aTelecharger = [];
  for (const chemin of chemins) {
    // Ne pas retelecharger ce qui est deja la : les fichiers Next portent un
    // condensat dans leur nom, une URL identique designe donc toujours le meme
    // contenu.
    if (!(await cacheStatique.match(chemin))) aTelecharger.push(chemin);
  }

  const TAILLE_PAQUET = 6;
  for (let i = 0; i < aTelecharger.length; i += TAILLE_PAQUET) {
    await Promise.allSettled(
      aTelecharger.slice(i, i + TAILLE_PAQUET).map(async (chemin) => {
        const reponse = await fetch(chemin, { credentials: 'same-origin' });
        if (reponse.ok) await cacheStatique.put(chemin, reponse);
      }),
    );
  }
}

self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'PURGER_PAGES') {
    event.waitUntil(caches.delete(CACHE_PAGES));
    return;
  }

  /**
   * Prechargement des destinations principales, demande par l'application
   * pendant qu'il y a du reseau.
   *
   * Sans lui, seules les pages **deja ouvertes** survivent a une coupure : un
   * utilisateur qui n'etait jamais alle sur « Mes classes » y trouvait l'ecran
   * d'erreur du navigateur. Or dans une ecole togolaise la coupure ne previent
   * pas, et personne ne pense a visiter chaque page « au cas ou ».
   *
   * On precharge **toutes** les destinations statiques du role connecte
   * (`cheminsAccessibles`), pas seulement la barre laterale : un ecran atteint
   * depuis une page de section doit survivre a la coupure lui aussi.
   *
   * Les routes dynamiques en sont absentes, faute d'identifiant : la fiche
   * d'un eleve ne se precharge pas, elle reste disponible si elle a ete
   * ouverte.
   *
   * Les echecs sont ignores un par un : une page qui ne repond pas ne doit pas
   * empecher les autres d'etre disponibles.
   */
  if (event.data.type === 'PRECHARGER_PAGES' && Array.isArray(event.data.urls)) {
    const urls = event.data.urls.slice(0, 40);
    event.waitUntil(precharger(urls));
  }
});

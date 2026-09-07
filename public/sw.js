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
const CACHE_VERSION = 'scolargest-v4';

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
      .then((cache) => cache.addAll(PRECACHE_URLS))
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
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached ?? (request.mode === 'navigate' ? caches.match('/offline') : Response.error())),
        ),
    );
    return;
  }

  // Assets statiques Next et icônes : cache d'abord, réseau en secours, et on
  // met en cache la réponse réseau pour la prochaine fois.
  const url = new URL(request.url);
  const isStaticAsset =
    url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/assets/');

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
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'PURGER_PAGES') {
    event.waitUntil(caches.delete(CACHE_PAGES));
  }
});

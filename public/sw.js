/*
 * Service worker ScolarGest.
 *
 * Rôle : rendre l'application *installable* (Chrome exige un service worker
 * avec un handler `fetch`) et fournir un cache de runtime discret. Ce n'est
 * volontairement PAS une stratégie hors-ligne complète — les données scolaires
 * sont sensibles et derrière auth/RLS, on ne met donc en cache que la coquille
 * statique. Voir PLAN.md § 8 « PWA ».
 *
 * Bump CACHE_VERSION à chaque changement de cette liste ou de la stratégie :
 * l'ancien cache est purgé à l'activation.
 */
const CACHE_VERSION = 'scolargest-v1';

// Ressources statiques sûres à précacher (pas de page authentifiée ici).
const PRECACHE_URLS = [
  '/manifest.webmanifest',
  '/assets/icons/android-chrome-192x192.png',
  '/assets/icons/android-chrome-512x512.png',
  '/assets/icons/favicon-32x32.png',
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
        Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))),
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

  // Navigations (pages HTML) : réseau d'abord, cache en secours si hors-ligne.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(request).then((cached) => cached ?? caches.match('/manifest.webmanifest')),
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

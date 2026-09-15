/**
 * Vocabulaire du bandeau d'abonnement, partagé par les deux côtés de la
 * frontière : le serveur lit le cookie avant de produire le bandeau, le client
 * l'écrit quand on ferme celui-ci.
 *
 * ## Pourquoi ce module existe
 *
 * Panne du 2026-09-15, en preview : ces deux exports vivaient dans
 * `BandeauMasquable.tsx`, marqué `'use client'`, et `AbonnementBanner` — un
 * composant **serveur** — les importait.
 *
 * Dans l'App Router, un module `'use client'` importé par un composant serveur
 * n'expose pas ses valeurs : il expose des **références client**. Appeler
 * `jourCourant()` depuis le serveur lève donc, et la constante n'est pas une
 * chaîne. Comme `AbonnementBanner` est monté dans `AppLayout`, **toutes** les
 * pages de l'espace école tombaient — le journal Vercel montrait un statut 0
 * sur `/dashboard`, sans pile, la fonction s'arrêtant en plein flux.
 *
 * Ni `tsc` ni ESLint ne voient cette frontière : le type est correct des deux
 * côtés. C'est la même famille que le composant client qui importe depuis
 * `src/services/` et fait entrer `next/headers` dans le bundle, à ceci près que
 * celle-ci tombe à l'exécution au lieu de casser le build.
 *
 * La parade est la même que celle déjà retenue dans ce dépôt : le vocabulaire
 * vit dans un module **sans dépendance et sans directive**, et les deux côtés
 * l'importent.
 */

/** Cookie qui mémorise « bandeau fermé pour aujourd'hui ». */
export const COOKIE_BANDEAU_ABONNEMENT = 'sg_bandeau_abonnement';

/**
 * Le jour courant, au format `AAAA-MM-JJ`.
 *
 * La valeur mémorisée est une **date** et non un booléen : le lendemain elle ne
 * correspond plus et le bandeau revient de lui-même. Aucune expiration à
 * calculer, aucun nettoyage.
 */
export function jourCourant(maintenant = new Date()): string {
  return maintenant.toISOString().slice(0, 10);
}

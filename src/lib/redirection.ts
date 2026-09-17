/**
 * Ce qu'on accepte comme destination après authentification.
 *
 * Module sans dépendance, comme `src/lib/tri-classes.ts` ou
 * `src/lib/support.ts` : il est importé par une route, et le sortir du
 * gestionnaire est ce qui le rend testable — un `route.ts` ne peut pas exporter
 * autre chose que ses méthodes HTTP sans que Next ne refuse la route.
 */

/**
 * Ramène `?next=` à un chemin de cette application, ou rend la destination par
 * défaut.
 *
 * **Sans cette fonction, `/auth/callback` était une redirection ouverte**,
 * constatée le 2026-09-17. La destination y était construite par
 * concaténation, `${base}${next}`, et `urlApplication()` retire délibérément
 * les barres finales. Donc `next=@evil.com` donnait :
 *
 *     https://scolargest.com@evil.com
 *
 * où `scolargest.com` n'est plus l'hôte mais un identifiant d'utilisateur, et
 * où le navigateur part chez `evil.com`. Le préfixe rassurant reste affiché
 * dans le lien qu'on fait cliquer, et la victime vient précisément de
 * s'authentifier — c'est le moment où elle accorde le plus de confiance à ce
 * qui s'affiche.
 *
 * Trois formes sont refusées, chacune pour sa raison :
 *
 * - `@hôte` — la forme ci-dessus, que tout contrôle portant sur `//` manque ;
 * - `//hôte` — protocole-relatif, qui change d'hôte à lui seul ;
 * - `/\hôte` — la barre inversée, que les navigateurs normalisent en barre :
 *   un `//hôte` déguisé.
 *
 * On exige un chemin absolu commençant par une seule barre. C'est plus strict
 * que nécessaire, et c'est voulu : **aucun appelant du dépôt ne passe `next`**
 * — ni le formulaire de connexion, ni les gabarits d'email Supabase, qui
 * envoient `token_hash` et `type` et rien d'autre. Le paramètre n'existe que
 * pour un usage futur, et un paramètre inutilisé qui ouvre une redirection ne
 * se négocie pas.
 */
export function destinationInterne(demandee: string | null | undefined, defaut: string): string {
  if (!demandee) return defaut;
  if (!demandee.startsWith('/')) return defaut;
  if (demandee.startsWith('//') || demandee.startsWith('/\\')) return defaut;
  return demandee;
}

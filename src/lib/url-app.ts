/**
 * URL publique de l'application, pour les liens que des tiers doivent suivre :
 * retour de paiement FedaPay, lien d'invitation Supabase.
 *
 * Trois sources, dans cet ordre.
 *
 * 1. `NEXT_PUBLIC_APP_URL` — le domaine voulu, à renseigner en production.
 * 2. `VERCEL_URL` — l'hôte du déploiement courant, fourni automatiquement par
 *    Vercel. C'est ce qui fait qu'une **preview renvoie sur elle-même** au lieu
 *    de rejeter l'utilisateur en production au retour d'un paiement. Sans ce
 *    repli, il fallait penser à déclarer une valeur différente par
 *    environnement, et l'oubli ne se voyait qu'au moment du test.
 * 3. `http://localhost:3000` en développement.
 *
 * `VERCEL_URL` ne porte pas de protocole : Vercel ne sert qu'en HTTPS, on le
 * préfixe donc systématiquement.
 */
export function urlApplication(): string {
  const explicite = process.env.NEXT_PUBLIC_APP_URL;
  if (explicite) return explicite.replace(/\/+$/, '');

  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel.replace(/\/+$/, '')}`;

  return 'http://localhost:3000';
}

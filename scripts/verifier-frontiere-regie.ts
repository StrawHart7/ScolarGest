/**
 * La Régie peut-elle atteindre le contenu d'une école ?
 *
 * ## Pourquoi ce script existe
 *
 * La promesse faite à l'utilisateur est que la console fondateur voit la
 * plateforme sans jamais voir le contenu : ni un élève, ni une note, ni une
 * facture. Une promesse tenue par de la discipline de code se perd au
 * troisième écran — il suffit d'un `select` écrit un soir de débogage.
 *
 * Elle est donc tenue par les **droits Postgres du rôle `regie`**, et ce
 * script constate qu'ils n'ont pas bougé. Le contrôle lui-même vit en base
 * (`public.regie_frontiere_debordements()`, migration `..._socle_regie.sql`),
 * parce qu'une liste de tables recopiée ici finirait par diverger de celle qui
 * fait foi. Ici il n'y a que l'appel et le verdict.
 *
 * ## Ce que le contrôle regarde
 *
 * Quatre débordements possibles, et deux contrôles positifs :
 *
 *   (a) un droit sur une table de `public` hors de la frontière déclarée ;
 *   (b) un schéma atteignable hors `controle` et `public` — `auth` et
 *       `storage` donneraient les comptes et les fichiers des écoles sans
 *       qu'aucun droit de table n'ait bougé ;
 *   (c) l'appartenance à un autre rôle ;
 *   (d) une fonction de `public` exécutable — un `SECURITY DEFINER` s'exécute
 *       avec les droits de son propriétaire et contournerait tout le reste ;
 *   (e) et, dans l'autre sens, que la Régie puisse bien lire et écrire ce que
 *       la frontière lui déclare. Un rôle qui ne peut rien faire passe
 *       évidemment tous les contrôles de non-accès : sans ce volet, le script
 *       rassurerait à tort le jour où le rôle disparaîtrait.
 *
 * ## Usage
 *
 *   npx tsx scripts/verifier-frontiere-regie.ts
 *
 * Sort en code 1 à la première ligne rendue. Le même appel est rejoué au
 * déploiement de la Régie, côté son dépôt : la frontière est un contrat entre
 * deux produits, elle se vérifie des deux côtés.
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env' });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const CLE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

interface Debordement {
  objet: string;
  privilege: string;
  constat: string;
}

async function principal(): Promise<void> {
  if (!URL || !CLE_SERVICE) {
    // Même parti pris que `verifier-separation-roles.ts` : un saut visible
    // vaut mieux qu'un rouge permanent qu'on finit par ignorer, et le dépôt
    // doit rester clonable sans secrets.
    console.log('NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY absente — contrôle sauté.');
    return;
  }

  const supabase = createClient(URL, CLE_SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.rpc('regie_frontiere_debordements');

  if (error) {
    // La fonction absente n'est pas un succès : c'est un contrôle qui n'a pas
    // eu lieu. Les erreurs Supabase ne sont pas des `Error` — on extrait les
    // champs plutôt que d'afficher `[object Object]`.
    const details = [error.message, error.details, error.hint, error.code]
      .filter(Boolean)
      .join(' · ');
    console.error(`Contrôle impossible : ${details}`);
    console.error(
      "Si la fonction n'existe pas, la migration `..._socle_regie.sql` n'a pas été appliquée.",
    );
    process.exit(1);
  }

  const debordements = (data ?? []) as Debordement[];

  if (debordements.length === 0) {
    console.log('Frontière Régie : aucun débordement, contrôles positifs passés.');
    return;
  }

  console.error(`Frontière Régie : ${debordements.length} constat(s).\n`);
  for (const d of debordements) {
    console.error(`  ${d.privilege.padEnd(12)} ${d.objet}`);
    console.error(`  ${' '.repeat(12)} ${d.constat}\n`);
  }
  console.error(
    'Chaque ligne est un droit que la Régie ne devrait pas avoir, ou un droit\n' +
      "déclaré qu'elle n'a pas. Corriger par une migration, jamais à la main sur\n" +
      'la base : un droit posé hors migration disparaît au provisionnement suivant.',
  );
  process.exit(1);
}

principal().catch((erreur) => {
  console.error(erreur);
  process.exit(1);
});

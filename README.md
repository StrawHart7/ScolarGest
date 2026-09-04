# ScolarGest

SaaS multi-établissements de gestion scolaire pour les écoles privées d'Afrique
de l'Ouest, à commencer par le Togo. En production sur
[scolargest.com](https://scolargest.com).

Le répertoire de travail et quelques documents anciens disent encore
« ScoolAdmin » : c'est le même projet, `ScolarGest` est le nom du produit.

**Périmètre** : collège et lycée uniquement. La maternelle et le primaire ont
été retirés du catalogue le 2026-08-31 (migration `0014`) — retirés, pas
supprimés : un établissement déjà en primaire garde ses classes, ses notes et
ses bulletins.

## Stack

| Couche       | Technologie                                                                  |
| ------------ | ---------------------------------------------------------------------------- |
| Application  | Next.js 14 (App Router) + TypeScript strict                                  |
| Style        | Tailwind + primitives maison inspirées de shadcn (Radix)                     |
| Formulaires  | react-hook-form + Zod                                                        |
| État serveur | TanStack Query                                                               |
| Auth         | Supabase Auth (`@supabase/ssr`, claims `role` + `etablissement_id`)          |
| Base         | PostgreSQL via Supabase, accédée par `@supabase/supabase-js` — **aucun ORM** |
| Stockage     | Supabase Storage                                                             |
| PDF          | HTML → PDF par Playwright / `@sparticuz/chromium`                            |
| Paiement     | FedaPay (Mobile Money)                                                       |
| Emails       | Resend                                                                       |
| Supervision  | Sentry                                                                       |
| Tests        | Vitest (unitaires) + Playwright (E2E)                                        |
| Hébergement  | Vercel + Supabase                                                            |

Pas de Prisma : les migrations sont des fichiers SQL versionnés sous
`supabase/migrations/`.

## Prérequis

- Node.js 20+
- Un projet Supabase (Postgres + Auth + Storage)
- `.env` rempli à partir de `.env.example`

## Démarrage

```bash
npm install
npx supabase db push     # applique supabase/migrations/*.sql
npm run dev
```

## Commandes

| Commande                | Description                                                   |
| ----------------------- | ------------------------------------------------------------- |
| `npm run dev`           | Serveur de développement                                      |
| `npm run build`         | Build de production                                           |
| `npm run lint`          | ESLint                                                        |
| `npm run typecheck`     | Vérification des types                                        |
| `npm run test`          | Tests unitaires (Vitest)                                      |
| `npm run test:e2e`      | Tests de bout en bout (Playwright)                            |
| `npx supabase db push`  | Applique les migrations                                       |
| `npx supabase db reset` | Réinitialise la base locale et rejoue migrations + `seed.sql` |

`.github/workflows/ci.yml` enchaîne `npm ci`, `lint`, **`typecheck`** puis
`test`. Lancer seulement lint et les tests laisse passer les erreurs de typage.

### Jeux de données

```bash
npm run seed:demo -- --list                                 # liste les établissements
npm run seed:demo -- --etablissement <uuid>                 # remplit une école de démonstration
npm run seed:demo -- --purge --seed --etablissement <uuid>  # purge puis re-remplit

npx tsx scripts/seed-onboarding-test.ts            # établissement VIDE + Directeur, pour /demarrage
npx tsx scripts/seed-onboarding-test.ts --reset    # purge puis recrée
npx tsx scripts/seed-onboarding-test.ts --purge    # supprime tout
```

`seed-demo` remplit une école entière — classes, élèves, notes, factures — et
crée des comptes de test. `seed-onboarding-test` en est le pendant _vide_ :
remplir l'établissement le ferait passer pour déjà configuré et sauterait tout
l'onboarding.

**`supabase/seed.sql` ne s'exécute qu'avec `db reset`.** Toute donnée de
catalogue système (cycles, niveaux, séries, plans) doit donc aussi vivre dans
une migration numérotée, sinon un environnement provisionné par `db push` seul
sera incomplet — voir `0003_seed_catalogues.sql`.

### Outils de vérification

```bash
npx tsx scripts/matrice-permissions.ts             # régénère Docs/11-Matrice-permissions.md
npx tsx scripts/matrice-permissions.ts --instantane # régénère l'instantané testé
npx tsx scripts/verifier-isolation.ts              # tente des accès croisés entre deux écoles
npx tsx scripts/verifier-isolation.ts --purge      # nettoie les écoles jetables
```

`verifier-isolation` passe par le chemin réel de l'application — client anon
plus session, **jamais** la clé service-role, qui contournerait précisément ce
qu'on teste.

## Architecture

```
src/
  app/           Routes App Router, avec leurs Server Actions (actions.ts)
                 et les composants clients propres à chaque écran
    (auth)/      Connexion, mot de passe oublié, mise à jour du mot de passe
  services/      Un fichier par domaine — règles métier, garde de rôle
                 (requireRole) et journalisation d'audit
  modules/
    academics/   Moteur de calcul des moyennes (fonctions pures, testées)
  components/
    ui/          Primitives (Button, Input, Select, Table, Dialog, graphes…)
    layout/      AppLayout, Sidebar, Header, PageHeader
  lib/
    supabase/    client.ts (navigateur), server.ts (SSR, RLS), admin.ts
                 (service-role — provisionnement d'utilisateurs uniquement)
    pdf/         Gabarits de bulletins, reçus, emplois du temps
    offline/     Brouillons de saisie de notes (IndexedDB)
supabase/
  migrations/    Migrations SQL numérotées, source de vérité du schéma
  seed.sql       Catalogues système (local uniquement)
scripts/         Semis, vérifications, captures
```

## Isolation entre établissements

Chaque table porte `etablissement_id`. **L'isolation est appliquée au niveau de
la base par les politiques Row Level Security** (voir
`supabase/migrations/0001_init.sql`) : chaque table comparée au claim JWT
`auth_etablissement_id()`, avec dérogation `SUPER_ADMIN`.

Le code applicatif passe malgré tout `etablissement_id` explicitement dans
chaque requête — défense en profondeur, et requêtes plus claires. Ne jamais
compter sur la seule RLS pour l'omettre.

Cinq rôles fixes : `SUPER_ADMIN`, `DIRECTEUR`, `SECRETAIRE`, `COMPTABLE`,
`ENSEIGNANT`. Pas de rôles dynamiques en v1.

## Invariants non négociables

- **Aucune suppression dure** des données financières, des notes, des factures
  ni des inscriptions — statuts `ANNULE` / `ARCHIVE`.
- **Historisation** : tarifs et coefficients sont rattachés à une année
  scolaire. Modifier une valeur courante ne doit jamais altérer un document
  déjà émis.
- **Une seule année scolaire active** par établissement.
- **Journal d'audit** sur toute écriture sensible (paiement, validation de
  note, création de compte).
- **Aucun emoji** nulle part dans le produit : interface, documents générés,
  notifications.

## Permissions

`Docs/11-Matrice-permissions.md` est **généré** depuis les `requireRole(...)`
des services. Un instantané versionné
(`src/lib/permissions/__tests__/matrice.instantane.txt`) est comparé par les
tests : **toute modification d'une garde de rôle fait échouer la suite**. C'est
voulu — après un changement délibéré, régénérer et relire le diff.

Attention : `requireRole()` sans argument signifie **SUPER_ADMIN seul**, pas
« tout utilisateur authentifié ».

## Documentation

| Fichier       | Contenu                                                                                                                |
| ------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `CLAUDE.md`   | Conventions, pièges connus, méthode de travail                                                                         |
| `PLAN.md`     | Feuille de route et journal des fonctionnalités livrées                                                                |
| `analysis.md` | Décisions de conception (Q0–Q17)                                                                                       |
| `Docs/`       | Règles métier par domaine, ERD, matrice de permissions — **hors dépôt** (`.gitignore`), à récupérer auprès de l'équipe |

Le système de design s'appelle « Luminous Institutional ». Ses jetons — couleurs,
échelle typographique, espacements, ombres — vivent dans `tailwind.config.ts`,
qui en est la source de vérité ; `CLAUDE.md` documente les règles d'usage
(motif de liste, champs de formulaire, tableaux, avertissement).

Les neuf phases initiales sont terminées ; le travail suivant est suivi par
fonctionnalité dans `PLAN.md` § 8. **Y figurer n'est pas une autorisation de
mise en œuvre** : une fonctionnalité ne démarre que sur demande explicite.

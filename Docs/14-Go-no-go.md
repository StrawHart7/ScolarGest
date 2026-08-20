# Go / no-go de mise en production

Bilan des contrôles de la Phase 9. Le principe de ce document : **rien n'est
coché sur la foi d'une lecture de code**. Un contrôle est vert quand quelque
chose l'a exécuté — un test, un script, ou une personne.

Date du bilan : 2026-08-20. Branche `phase-9-durcissement-production`.

---

## 1. Contrôles automatisés — verts

| Contrôle | Preuve | Résultat |
|---|---|---|
| Isolation entre écoles | `npx tsx scripts/verifier-isolation.ts` | 9 tentatives d'accès croisé, **0 fuite, 0 non concluante** |
| Matrice de permissions figée | `matrice.test.ts` (instantané de 158 gardes) | vert |
| Aucune fonction sans garde ne touche la base | `matrice.test.ts` | vert, 1 exception nominative documentée |
| Couverture AuditLog (doc 03 § 12) | `audit-couverture.test.ts` | 11 exigences couvertes |
| Permissions vues du navigateur | `e2e/permissions.spec.ts` | 3 rôles |
| Gardes d'authentification | `e2e/auth-guard.spec.ts` | 41 tests |
| Suite E2E complète | `npm run test:e2e` | **57 passés, 1 sauté, 0 échec, 0 flaky** |
| Tests unitaires | `npm run test` | **182 passés**, 1 sauté |
| Build, lint | `npm run build && npm run lint` | vert |

Le test sauté est la session DIRECTEUR : aucun compte Directeur de démonstration
n'existe. À créer pour compléter la couverture.

### Ce que l'isolation prouve exactement

Connecté comme **Directeur de l'école A**, par le chemin réel de l'application
(client anon + session, jamais la clé service-role) :

| Tentative sur les données de l'école B | Résultat |
|---|---|
| lire un élève par son identifiant | bloqué |
| lire une classe par son identifiant | bloqué |
| lire l'année scolaire | bloqué |
| lister les élèves de l'établissement | bloqué |
| lire l'abonnement | bloqué |
| lire le journal d'audit | bloqué |
| lire les utilisateurs | bloqué |
| renommer un élève | bloqué |
| insérer un élève | refusé (42501) |

Chaque cible est confirmée présente en base avant la tentative : une lecture qui
ne ramène rien parce que la table est vide ne prouverait rien.

## 2. Corrections apportées pendant la phase

Aucune n'était une fuite exploitable — la RLS tenait dans tous les cas — mais
toutes reposaient sur une policy sans filet applicatif, contrairement à la règle
de défense en profondeur du projet.

| Point | Avant | Après |
|---|---|---|
| `getAbonnementCourant` | `etablissementId` libre, aucune garde | garde de rôle + comparaison au contexte |
| `listPaiementsAbonnement` | aucune garde | Directeur ; l'écran reste ouvert à tous, l'historique non |
| `listPlans`, `listCycles`, `listNiveauxParCycle`, `listSeriesParCycle` | lisibles sans session | session exigée |
| `enregistrerDocument`, `marquerObsolete` | session seule | Directeur, Secrétaire, Comptable |
| Connexion (mot de passe **et** Google) | non journalisée | journalisée, succès et échecs |
| `createEtablissement` | non journalisée | journalisée |
| `/sentry-example-page` | exposée en production | supprimée |
| Route refusée | « Application error: a client-side exception has occurred » | page « Accès refusé » traduite, avec issue (`src/app/error.tsx`) |

La dernière ligne mérite un mot : une garde qui refusait l'accès produisait un
écran blanc en anglais, sans issue, indiscernable d'une panne. Une Secrétaire
qui tape `/super-admin` en concluait que l'application était cassée. La nouvelle
frontière d'erreur distingue le refus d'accès — qui propose de revenir au
tableau de bord — de la panne réelle — qui propose de réessayer et affiche une
référence. Un refus n'est plus remonté à Sentry : ce n'est pas un incident, et
l'y envoyer noierait les vraies pannes.

## 3. Ce qui reste ouvert — à trancher avant le go

| Point | État | Ce qu'il faut |
|---|---|---|
| **Test de restauration d'une sauvegarde** | non fait | Restaurer une sauvegarde sur un projet jetable et chronométrer. Voir `Docs/12-Exploitation.md` § 1. |
| **Plan Supabase de production** | non confirmé | Les sauvegardes automatiques ne sont pas offertes sur le plan gratuit. |
| **Sauvegarde du Storage** | non définie | Les PDF ne sont pas dans la sauvegarde de la base. |
| **Alertes Sentry** | non configurées | Taux d'erreur, échecs d'authentification répétés. |
| **E2E des parcours en écriture** | non livrés | Voir § 4. |
| **Checklist d'onboarding** | rédigée, non jouée | La suivre de bout en bout sur une école réelle (`Docs/13`). |
| **Parcours manuel des 4 rôles** | à faire par vous | Voir § 5. |
| **Tests de charge multi-école** | reporté | Décision assumée : le plan gratuit rend la mesure peu représentative. |

## 4. Pourquoi les E2E en écriture ne sont pas livrés

Le projet interdit les suppressions physiques pour les paiements, les notes et
les inscriptions — c'est un invariant, pas une préférence. Un test E2E qui
encaisse un paiement laisse donc une ligne **définitive**, à chaque exécution.

Or la base de production contient déjà 285 élèves et des comptes réels : ce
n'est pas un bac à sable. Faire tourner des parcours d'écriture dessus y
accumulerait des données de test indélébiles.

Trois voies possibles, à arbitrer :

1. **École jetable dédiée**, seedée par `seed:demo`, purgeable. Le plus propre ;
   demande de câbler le seed sur l'école de test.
2. **Écritures assumées dans l'école de démo**, objets préfixés `E2E-`.
3. **Renoncer aux E2E d'écriture**, et valider ces parcours à la main à chaque
   version — à consigner comme dette, avec le coût récurrent que cela implique.

## 4 bis. Démarrage à froid : 106 à 208 secondes

Mesuré sur la machine de développement, `next start` met entre 106 et 208 s à
devenir disponible. C'est ce qui faisait expirer le harnais Playwright avant
qu'un seul test ne s'exécute.

Sur Vercel, ce délai est ce que paierait le premier visiteur après une période
d'inactivité. À mesurer sur l'environnement réel avant le go : si l'ordre de
grandeur se confirme, il faut soit un plan qui garde les fonctions chaudes, soit
alléger le hook d'instrumentation.

- [ ] Temps de démarrage à froid mesuré sur Vercel.

## 5. Ce que les tests ne peuvent pas remplacer

Sur **chaque** phase précédente, le parcours manuel a révélé au moins un défaut
qu'une suite verte ne voyait pas : boutons illisibles en Phase 8.5, écran des
résultats qui ne s'affichait jamais, coefficients de série écrasés d'une série à
l'autre. Une suite verte prouve que ce qui est testé fonctionne, pas que le
produit est bon.

Avant le go, à faire par vous, avec les comptes de démo (`Demo2026!`) :

- [ ] Directeur : tableau de bord, structure, rapports.
- [ ] Secrétaire : inscription d'un élève, saisie et soumission de notes.
- [ ] Comptable : encaissement d'un paiement, édition d'un reçu.
- [ ] Enseignant : saisie de notes sur ses classes, et **seulement** les siennes.

## 6. Décision

> **À compléter après les points 3, 4 et 5.**
>
> Décision : ☐ Go ☐ Go conditionnel ☐ No-go
>
> Motif :
>
> Date, personne :

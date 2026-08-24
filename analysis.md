# Analyse critique du projet — Gestion Scolaire SaaS

> Document de travail. Objectif : repérer les zones d'ombre, contradictions et
> décisions non tranchées avant d'écrire le PLAN et de figer la stack.
> Chaque point se termine par une **question** à trancher.

---

## 0. Remarque transversale : les sections « # Modifications »

Presque chaque document se termine par une section `# Modifications` qui **contredit
le corps du même document**. Ces notes sont manifestement des décisions plus récentes
que le texte n'a pas encore intégrées. Tant qu'elles ne sont pas fusionnées, chaque
document dit deux choses opposées. La plus grande source d'incohérence du corpus vient
de là. Les points ci-dessous en tiennent compte explicitement.

**Q0. Est-ce que je considère les sections « Modifications » comme la vérité la plus
récente (donc prioritaire sur le corps du texte) ? Si oui, je les intègre et je réécris
les docs proprement.**

> **RÉPONSE** : Oui. Les sections "Modifications" sont la vérité définitive et prioritaires sur le corps du texte. Les docs seront réécrits en conséquence avant implémentation.

---

## 1. Liste des rôles — incohérence directe

- Docs 02 et 03 : `SUPER_ADMIN, DIRECTEUR, SECRETAIRE, COMPTABLE, ENSEIGNANT` (5 rôles).
- Doc 10 §13 : `SUPER_ADMIN, ADMIN_ETABLISSEMENT, DIRECTEUR, SECRETARIAT, COMPTABLE, ENSEIGNANT` (6 rôles, avec doublons de nommage).
- Les « Modifications » demandent de supprimer `ADMIN_ETABLISSEMENT` et `SECRETARIAT`.

**Q1. La liste définitive est-elle bien les 5 rôles (SUPER_ADMIN, DIRECTEUR, SECRETAIRE,
COMPTABLE, ENSEIGNANT) ? Existe-t-il un besoin réel d'un `ADMIN_ETABLISSEMENT` distinct
du DIRECTEUR (ex. un propriétaire/fondateur au-dessus du directeur pédagogique) ?**

> **RÉPONSE** : 5 rôles confirmés : `SUPER_ADMIN`, `DIRECTEUR`, `SECRETAIRE`, `COMPTABLE`, `ENSEIGNANT`. Pas de rôle propriétaire/fondateur distinct. Un directeur = une école.

---

## 2. Compte utilisateur de l'enseignant — obligatoire ou optionnel ?

- Doc 06 (corps) : un enseignant **n'a pas forcément** de compte (relation `Enseignant 0..1 Utilisateur`).
- Doc 06 (Modifications) : le compte devient **obligatoire** pour tout enseignant actif (traçabilité).
- Or l'email de l'enseignant est facultatif dans la structure, alors qu'un compte
  (surtout via un fournisseur d'identité type Supabase Auth) exige un email unique.

**Q2. Tout enseignant actif doit-il obligatoirement avoir un compte + un email ? Comment
gère-t-on l'enseignant réel sans email (fréquent) : email fictif, compte créé par le
directeur sans email, ou on garde l'enseignant « sans compte » comme cas légitime ?**

> **RÉPONSE** : Compte obligatoire pour tout enseignant actif. Le Directeur fournit un email à la création (email personnel ou générique de l'école). Supabase Auth envoie une invitation. L'email devient identifiant unique — pas d'enseignant actif sans compte.

---

## 3. Authentification : champ `mot_de_passe_hash` vs fournisseur externe (Supabase Auth)

- Doc 03 : entité `Utilisateur` avec `mot_de_passe_hash`, plus récupération/expiration
  gérées par nous.
- Doc 02 (Modifications) : figer la stack sur **Supabase Auth** + section sur la liaison
  compte Supabase Auth ↔ Utilisateur (provisioning → invitation → binding par email).

Ces deux visions s'excluent : soit on stocke et gère nous-mêmes les mots de passe, soit
Supabase Auth est la source de vérité de l'identité et notre table `Utilisateur` ne contient
plus de hash mais un `clerk_user_id` + un rôle + un `etablissement_id`.

**Q3. On confirme Supabase Auth comme fournisseur d'identité (donc on supprime
`mot_de_passe_hash` et on ajoute `clerk_user_id`) ? Ou on préfère une auth maison /
autre solution pour garder la maîtrise (coût, résidence des données, comptes sans
email) ?**

> **RÉPONSE** : Supabase Auth confirmé pour l'authentification principale. Mais il existe un **second facteur applicatif** (step-up auth) : un PIN à 6 chiffres, géré par nous (stocké hashé dans notre table `Utilisateur`), requis au moment de valider une action d'approbation. Ce PIN est distinct du mot de passe Supabase Auth — c'est une signature électronique interne. Tous les rôles qui reçoivent des demandes d'approbation possèdent ce PIN (actuellement : la Secrétaire). La table `Utilisateur` supprime `mot_de_passe_hash` / `token_reinitialisation` / `expiration_token`, et ajoute `clerk_user_id` + `pin_approbation_hash`.

> **Modifications** : pas de `clerk_user_id` — l'identité Supabase Auth est directement la clé primaire (`utilisateur.id = auth.users.id`), pas de colonne séparée. `pin_approbation_hash` inchangé.

---

## 4. Isolation multi-tenant : applicative seule ou renforcée par la base ?

- Le principe « base unique + `etablissement_id` filtré partout » est répété comme règle
  absolue. Mais c'est une isolation **purement applicative** : une seule requête mal
  filtrée expose les données d'une autre école.
- Rien n'est dit sur le **Row Level Security (RLS) PostgreSQL**, qui est justement le
  filet de sécurité que Supabase encourage. Avec Supabase Auth comme auth, brancher le RLS sur
  le tenant demande un travail spécifique (JWT → claim tenant).

**Q4. Veut-on une isolation défendue aussi au niveau base (RLS Postgres), ou on assume
une isolation applicative stricte via une couche d'accès aux données centralisée (chaque
requête passe par un « repository » qui injecte le tenant) ? Ce choix change fortement
l'architecture technique.**

> **RÉPONSE** : Isolation applicative stricte via repository pattern. Chaque accès aux données passe par une couche centralisée qui injecte `etablissement_id` obligatoirement. Pas de RLS Postgres en v1 (incompatibilité Prisma, complexité inutile). Peut être ajouté post-lancement si audit de sécurité l'exige.

> **Modifications** : décision inversée — le projet reste sur Supabase (pas de Prisma), donc RLS Postgres est activé dès la v1 (`supabase/migrations/0001_init.sql`) sur `etablissement_id`, avec bypass `SUPER_ADMIN`. La couche service applique toujours un filtre explicite en défense en profondeur, mais l'isolation n'est plus purement applicative.

---

## 5. Modèle commercial : « essai gratuit » vs « demande de démo »

- Doc 08 §23 : statut d'abonnement inclut `ESSAI`.
- Vision (Modifications) : retirer « essai gratuit », remplacer par « demande de démo ».

**Q5. On retire définitivement le mode ESSAI (donc pas de self-service : toute école
passe par une demande + validation manuelle) ? Ou on garde un essai encadré ?**

> **RÉPONSE** : Demande de démo uniquement. Pas de self-service. Le SUPER_ADMIN crée chaque école manuellement après contact. Paiement de l'abonnement par virement/Mobile Money validé manuellement par le SUPER_ADMIN dans le back-office. Paiement intégré reporté à une version ultérieure.

---

## 6. Les 3 « workflows d'approbation » — cités partout, spécifiés nulle part

Plusieurs Modifications (docs 01, 03, 07, 10) ajoutent des « workflows d'approbation »
(Directeur / Secrétaire / Comptable) désormais dans le périmètre v1.0, avec par exemple :
verrouillage des notes après édition du bulletin trimestriel, puis « workflow
d'approbation (Secrétaire) pour toute modification post-verrouillage » ; immuabilité du
`TarifScolaire` ; statut `EN_ATTENTE/VALIDE/REJETE` sur `Note`.

Problèmes :
- Le contenu exact des 3 workflows n'est jamais décrit.
- Il paraît étrange qu'une **secrétaire** approuve une correction de **note** (relève
  plutôt du directeur ou de l'enseignant). Le rôle approbateur semble à vérifier.

**Q6. Peux-tu décrire précisément les 3 workflows : (a) qui déclenche, (b) qui approuve,
(c) sur quel objet, (d) quel effet ? Exemple attendu : « modification d'une note
verrouillée → demandée par l'enseignant → approuvée par le directeur ».**

> **RÉPONSE** : 3 mécanismes distincts, pas un moteur générique :
>
> **Workflow 1 — Modification de note (seul vrai workflow avec file d'attente)**
> - Déclencheur : un Enseignant modifie une note **déjà soumise**
> - Approbateur : la **Secrétaire** (pas le Directeur)
> - Interface : à la connexion, la Secrétaire voit un modal/liste des notes en attente
> - Actions possibles : Valider / Rejeter / Proposer une modification
> - Chaque action requiert la saisie du **PIN à 6 chiffres** (step-up auth) avant effet
> - Tant que non soumise, l'Enseignant peut modifier librement sans workflow
>
> **Workflow 2 — Tarifs scolaires**
> - Pas de workflow : les `TarifScolaire` sont **immuables** une fois créés
> - Correction = créer un nouveau tarif, jamais modifier l'existant
>
> **Workflow 3 — Évaluations et bulletins**
> - Pas de workflow : la Secrétaire crée et génère librement
> - Le Directeur voit passer les actions dans son flux d'activité, sans validation requise

---

## 7. Granularité des tarifs scolaires

- `TarifScolaire` porte `niveau_id` (tarif par niveau).
- Mais doc 08 §8 dit que le prix peut différer **par classe/série** (Terminale D ≠
  Terminale A4). Or série et classe ne sont pas dans l'entité.

**Q7. Le tarif est-il défini au niveau `Niveau`, `Niveau + Série`, ou carrément `Classe` ?
(Impact direct sur le modèle et sur la génération des factures.)**

> **RÉPONSE** : Par classe. Les tarifs sont saisis lors de la création de chaque classe. `TarifScolaire` référence `classe_id` (pas `niveau_id`). La facture d'un élève est générée à partir des tarifs de sa classe.

---

## 8. Modèle académique : incohérences de nommage et de calcul

- Doc 07 nomme l'entité `ProgrammeEtablissement` mais doc 10 §8 parle de `ProgrammeNiveau`
  pour la même chose.
- `CoefficientMatiere` référence `programme_etablissement_id + serie_id`. Pour la
  maternelle/primaire/collège (sans série), `serie_id` est nul : il faut confirmer que le
  coefficient est alors porté au niveau du programme.
- Le coefficient « peut évoluer par année » est évoqué mais `annee_scolaire_id` n'est
  qu'« évolution possible ». Donc en l'état, changer un coefficient **écrase**
  rétroactivement les anciens bulletins — ce qui contredit le principe « les anciens
  bulletins doivent rester corrects ».

**Q8. (a) On fige un seul nom (`ProgrammeEtablissement`) ? (b) Le coefficient est-il
historisé par année scolaire dès la v1.0 (recommandé pour ne pas casser les anciens
bulletins) ou on l'assume figé ?**

> **RÉPONSE** : (a) Nom figé : `ProgrammeEtablissement`. (b) Coefficients historisés dès v1 — `CoefficientMatiere` porte un `annee_scolaire_id`. Toute modification crée une nouvelle entrée, l'ancienne est conservée. Les anciens bulletins restent toujours corrects.

---

## 9. Livret (primaire/maternelle) vs Bulletin (secondaire)

- Doc 07 (Modifications) introduit la distinction Livret vs Bulletin.
- Mais **toute** la mécanique de calcul (interro/devoir/composition, moyenne /20,
  classement, appréciations 10–20) est décrite de façon uniforme.
- En maternelle, on n'évalue normalement pas sur /20 avec un rang : c'est un livret de
  compétences.

**Q9. La maternelle (et éventuellement le primaire) suit-elle le même barème /20 +
classement, ou bien un livret d'appréciations/compétences distinct ? Si distinct, faut-il
le livrer en v1.0 ou le reporter ? (Le corpus reste très « secondaire ».)**

> **RÉPONSE** : Même barème /20 pour tous les niveaux en v1. Priorité au collège (le plus stable et le premier marché cible). Livret de compétences maternelle/primaire reporté à une version ultérieure.

---

## 10. Barème, appréciations et cas limites de calcul

- Le barème /20 est supposé partout mais jamais posé comme règle.
- Les appréciations ne couvrent que 10–20 ; en dessous de 10, « à définir ».
- Formule moyenne interro = somme / nombre : que se passe-t-il s'il y a **0 interro** dans
  une période ? Un seul devoir est prévu, mais s'il y a **plusieurs devoirs** ?
- Que devient une matière **facultative** dans le calcul de la moyenne générale (comptée
  ou non, coefficient 0 ?).

**Q10. Peux-tu fixer : (a) le barème (20), (b) les appréciations sous 10, (c) le
comportement quand une composante manque (pas d'interro / pas de devoir), (d) le
traitement des matières facultatives dans la moyenne générale ?**

> **RÉPONSE** :
> (a) Barème /20 confirmé.
> (b) Tableau complet des appréciations :
> | Tranche | Appréciation |
> |---|---|
> | 18–20 | Excellent |
> | 16–18 | Très Bien |
> | 14–16 | Bien |
> | 12–14 | Assez Bien |
> | 10–12 | Passable |
> | 8–10 | Insuffisant |
> | 6–8 | Très Insuffisant |
> | 4–6 | Très Mal |
> | 0–4 | Médiocre |
>
> (c) Composante manquante : on calcule avec ce qui existe. Pas d'interro = moyenne de période basée sur le devoir seul. Pas de devoir = basée sur les interros seules.
> (d) Matières facultatives : incluses dans la moyenne générale si l'élève a une note. Si aucune note saisie pour cette matière, elle est ignorée (ni bonus ni malus).

---

## 11. Génération des factures — déclenchement

Le domaine finance décrit la facture et les paiements, mais **ne dit pas** quand ni
comment la `FactureEleve` est créée : automatiquement à l'inscription à partir des
`TarifScolaire` du niveau, ou saisie manuellement par le comptable ?

**Q11. La facture est-elle générée automatiquement à l'inscription (somme des tarifs
applicables) ou construite manuellement ligne par ligne par le comptable ?**

> **RÉPONSE** : Automatique avec ajustements. À la validation de l'inscription, le système génère la `FactureEleve` à partir des tarifs de la classe. Le comptable peut ensuite ajouter, modifier ou supprimer des lignes avant de valider définitivement la facture (pour gérer remises, cas particuliers, enfants du personnel, etc.).

---

## 12. Séquences et unicité des identifiants (matricules, n° reçus, bulletins)

Formats donnés : `ELV-2026-000154`, `ENS-2026-0042`, `REC-2026-001542`, `BUL-2026-000125`.
Non précisé : la séquence est-elle **globale à la plateforme** ou **remise à zéro par
établissement et par année** ? En multi-tenant, une numérotation par établissement est
généralement attendue (chaque école veut ses reçus n°1, 2, 3…), mais elle est plus
délicate à générer sans collision.

**Q12. Les numéros (matricule, reçu, bulletin) sont-ils séquentiels par établissement (et
par année) ou globaux ? Le préfixe année est-il l'année civile ou l'année scolaire ?**

> **RÉPONSE** : Séquences par établissement (et par année scolaire). Chaque école a ses propres compteurs qui repartent à zéro chaque année scolaire. Le préfixe année est l'année de début de l'année scolaire (ex. `2025` pour l'année 2025–2026).

---

## 13. Passage automatique / réinscription — table de correspondance des niveaux

Le « passage automatique » (CM2 → 6ème, etc.) est validé, mais il suppose un ordre total
des niveaux **traversant les cycles** (fin du primaire → début du collège). Non précisé :
- la table de correspondance niveau → niveau suivant ;
- le cas terminal (Terminale → sortie, pas de niveau suivant) ;
- la limite de redoublements.

**Q13. Confirmes-tu qu'on gère la progression comme une séquence ordonnée fixe
(Togo) traversant les cycles, avec un cas « sortie » en fin de Terminale ? Y a-t-il une
règle sur le nombre de redoublements ?**

> **RÉPONSE** : (a) Séquence ordonnée fixe confirmée. Chaque niveau a un "niveau suivant" configuré par le SUPER_ADMIN. Cas spécial "sortie" en fin de Terminale. (b) Pas de limite de redoublements — discrétion du Directeur. (c) À la clôture d'année, le système propose le passage automatique des élèves admis ; le Directeur/Secrétaire valide ou ajuste manuellement élève par élève.

---

## 14. Contraintes non exprimées sur l'année scolaire

Rien n'indique qu'il ne peut y avoir **qu'une seule année scolaire `ACTIVE`** par
établissement à un instant donné, ni comment se fait la bascule `ACTIVE → TERMINEE`
(clôture) et son effet (verrouillage des saisies de l'année close ?).

**Q14. Une seule année `ACTIVE` à la fois par école ? La clôture d'une année
verrouille-t-elle définitivement les notes/paiements de cette année ?**

> **RÉPONSE** : (a) Une seule année `ACTIVE` par école à la fois confirmé. (b) La clôture ne verrouille pas définitivement — le Directeur et la Secrétaire conservent leurs droits de modification sur une année `TERMINEE` (via le workflow d'approbation habituel pour les notes).

---

## 15. Abonnement SaaS : paiement et effet de la suspension

- `PaiementAbonnement` a un `mode_paiement` mais aucun moyen de paiement en ligne n'est
  prévu (Mobile Money togolais ? virement manuel pointé par le SUPER_ADMIN ?).
- Statut `SUSPENDU`/`EXPIRE` : quel comportement concret ? Blocage total, lecture seule,
  bandeau d'avertissement ? Le doc 08 (Modifications) dit que les statuts de paiement
  **scolaires** sont purement informatifs, mais ne dit rien de l'effet du non-paiement de
  **l'abonnement**.

**Q15. Comment les écoles paient l'abonnement (Mobile Money, virement + validation
manuelle) ? Et que se passe-t-il concrètement à l'expiration : accès bloqué, lecture
seule, ou simple relance ?**

> **RÉPONSE** (2026-08-25) : virement ou Mobile Money, pointé manuellement par le
> SUPER_ADMIN (pas de paiement en ligne intégré). À l'expiration : lecture seule
> (consultation et documents restent accessibles, écritures refusées) — ne jamais
> prendre les données d'une école en otage pour un simple oubli d'échéance. À la
> suspension explicite par le SUPER_ADMIN (impayé persistant, litige) : accès
> applicatif entièrement fermé, redirection vers une page d'information — délibérément
> plus strict que l'expiration, confirmé après test manuel. Détail dans `Docs/08 §20`
> et `src/services/abonnement-acces.ts`.

---

## 16. Contexte local (Togo) : hébergement, connectivité, devise

Le produit vise d'abord le Togo, mais rien n'est dit sur :
- la **connectivité** (coupures fréquentes) → un mode dégradé / hors-ligne est-il
  nécessaire ? Le MVP existant est justement une app **desktop locale**, ce qui suggère
  que la connexion permanente n'est pas garantie ;
- la **résidence des données** et le coût d'un hébergement en devise étrangère
  (Vercel/Supabase facturés en USD/EUR) ;
- la langue (français uniquement ?).

**Q16. Un fonctionnement 100 % web/en ligne est-il acceptable pour les écoles cibles, ou
faut-il prévoir un mode hors-ligne/synchronisation (vu que le MVP actuel est une app
desktop) ? Y a-t-il une contrainte de localisation des données ou de coût
d'hébergement ?**

> **RÉPONSE** : 100 % web/en ligne. Pas de mode hors-ligne en v1. La question sera réévaluée après retours des premiers clients.

---

## 17. Lien avec le MVP existant (app desktop Python/PyQt6 + SQLite)

Le dossier `MVP/` contient une application **desktop** déjà fonctionnelle (Python, PyQt6,
SQLite, génération PDF, sauvegarde Google, système de licence). Le projet SaaS est une
**réécriture web complète**, pas une évolution de ce code.

**Q17. Le MVP desktop sert-il de (a) simple référence fonctionnelle/UX à reproduire, (b)
source de données à migrer pour les écoles déjà équipées, ou (c) on l'abandonne
totalement ? Faut-il un chemin de migration SQLite → SaaS ?**

> **RÉPONSE** : Abandon total. Le MVP desktop est ignoré — pas de référence fonctionnelle, pas de migration de données. Table rase.

---

## Synthèse des décisions bloquantes (à trancher en priorité)

Avant le PLAN, les 4 vraiment structurantes :

1. **Q3/Q4** — Auth + isolation : Supabase Auth + RLS, ou auth maison + isolation applicative.
   (Détermine toute l'architecture technique.)
2. **Q16/Q17** — Full web vs mode hors-ligne, et sort du MVP desktop.
   (Détermine si c'est un « vrai » SaaS pur ou un hybride.)
3. **Q6** — Contenu réel des 3 workflows d'approbation.
   (Fonctionnalité v1.0 non spécifiée.)
4. **Q0** — Statut des sections « Modifications » (source de vérité ?).
   (Débloque la moitié des autres incohérences.)

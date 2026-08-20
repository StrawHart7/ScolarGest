# PLAN — ScolarGest (SaaS de gestion scolaire)

> Feuille de route de développement vers un produit fonctionnel.
> Toutes les décisions de conception sont tranchées dans `analysis.md` (Q0–Q17).
> Style : aucun emoji nulle part dans le produit (UI, documents générés, notifications).

---

## 1. Stack retenue

| Couche | Choix |
|---|---|
| Full-stack / UI | Next.js (App Router) + TypeScript + Server Actions |
| Style | Tailwind CSS (tokens `DESIGN.md`) + shadcn/ui |
| Données / formulaires | TanStack Query, react-hook-form, Zod |
| Base de données | PostgreSQL (Supabase) |
| Accès données | `@supabase/supabase-js` / `@supabase/ssr` (pas d'ORM) |
| Isolation tenant | Row Level Security (RLS) Postgres via Supabase, sur `etablissement_id` |
| Authentification principale | Supabase Auth (`@supabase/ssr`, claims `etablissement_id` + `role` dans `app_metadata`) |
| Step-up auth | PIN 6 chiffres hashé en interne (`pin_approbation_hash`) |
| Stockage fichiers | Supabase Storage |
| Génération PDF | HTML → PDF via Playwright (serveur) |
| Tests | Vitest (unitaire) + Playwright (E2E) |
| Hébergement | Vercel + Supabase |

---

## 2. Principes de développement (non négociables)

1. **Logique métier hors UI** — toute règle (calculs, workflows) vit dans une couche `services`/`domain`, jamais dans les composants React.
2. **Organisation par domaine** — `students/`, `teachers/`, `finance/`, `academics/`, `reports/`, `identity/`, chacun avec `models/` `services/` `validations/` `components/`.
3. **Tenant partout** — isolation appliquée en base via RLS Postgres (Supabase) sur `etablissement_id`, doublée d'un filtre explicite côté service (défense en profondeur). Interdit d'appeler le client Supabase directement depuis une route sans passer par la couche service.
4. **Pas de suppression destructive** — statut `ANNULE`/`ARCHIVE`, jamais de `DELETE` sur données sensibles (paiements, notes, factures, inscriptions).
5. **Audit** — chaque action sensible écrit une entrée `AuditLog` (ancienne/nouvelle valeur).
6. **Historisation** — coefficients, affectations, inscriptions sont rattachés à une année scolaire ; changer une valeur ne casse jamais un ancien document.
7. **Fiabilité des calculs** — le moteur de moyennes est couvert par des tests unitaires exhaustifs avant toute UI de notes.
8. **Immuabilité des tarifs** — un `TarifScolaire` ne se modifie jamais ; correction = nouveau tarif.
9. **Une seule année ACTIVE** — contrainte enforced en base et en service.
10. **Style au fil de l'eau, pas de phase dédiée** — il n'y a pas de phase "styling" séparée : chaque page livrée dans une phase doit être vérifiée visuellement contre sa maquette dans `/design-maquette` avant d'être considérée terminée (pas juste fonctionnelle). Aucun emoji nulle part dans le produit.

---

## 3. Séquencement par phases

Chaque phase liste : objectif, livrables, dépendances, et Définition de Terminé (DoD).

---

### Phase 0 — Fondations (socle technique) — ✅ TERMINÉE (2026-08-17)

**Objectif** : un squelette déployable, sécurisé, avec le modèle de données complet et la couche tenant en place.

**Livrables** :
- Repo, conventions ESLint/Prettier, CI (lint + typecheck + tests), environnements (dev / preview / prod).
- Design system : tokens `DESIGN.md` → config Tailwind, composants de base shadcn/ui (Button, Input, Table, Card, Badge, Sidebar) au style « Luminous Institutional ».
- **Référence de maquettes** : avant de créer une nouvelle page, chercher dans `/design-maquette` le sous-dossier correspondant à la page (nommage `nom_de_la_page_edusync_erp`) et l'inspecter pour en reprendre le style avant implémentation.
- **Schéma SQL Supabase complet** du noyau métier (issu du doc 10), en migrations versionnées (`supabase/migrations/`) — toutes les entités, relations, contraintes, enums, policies RLS.
  - Entités clés : `Utilisateur` (id = auth.users.id, pin_approbation_hash), `Etablissement`, `AnneeScolaire`, `Cycle`, `CycleEtablissement`, `Niveau` (niveau_suivant_id), `Serie`, `Classe`, `Eleve`, `Inscription`, `Responsable`, `EleveResponsable`, `Enseignant`, `AffectationEnseignant`, `TitulariteClasse`, `Matiere`, `ProgrammeEtablissement`, `CoefficientMatiere` (annee_scolaire_id), `Evaluation`, `Note`, `TypeFrais`, `TarifScolaire` (classe_id), `FactureEleve`, `LigneFacture`, `Paiement`, `Document`, `PlanAbonnement`, `AbonnementEtablissement`, `PaiementAbonnement`, `AuditLog`.
- Migrations initiales + seed des **catalogues système Togo** : cycles, niveaux fixes avec `niveau_suivant_id`, séries lycée.
- Couche d'accès tenant : `getTenantContext()` (lit `role` + `etablissement_id` depuis le JWT Supabase `app_metadata`) + RLS Postgres par table.
- Intégration Supabase Auth : login (Server Action `signInWithPassword`) + Google OAuth (`signInWithOAuth` + route `/auth/callback`), session, middleware de refresh, extraction `etablissement_id` + `role` depuis les claims. Page login stylée conforme à `design-maquette/connexion_edusync_erp`.
- Helper `auditLog()` réutilisable, vérifié en conditions réelles (RLS + FK `utilisateur`).
- Layout applicatif (sidebar 260px, header 56px) conforme au design.
- Sentry (`@sentry/nextjs`) configuré (org `hartkitco`, projet `scolargest`).

**DoD** — validé le 2026-08-17 : utilisateur de test connecté via Supabase Auth (SUPER_ADMIN et DIRECTEUR) ; RLS testée avec 2 établissements distincts, isolation confirmée ; audit log vérifié via bouton de test sur `/dashboard` ; CI verte ; schéma revu contre doc 10.

---

### Phase 1 — Établissement, structure scolaire & utilisateurs — ✅ TERMINÉE (2026-08-18)

**Objectif** : le back-office minimal permettant à notre équipe de créer une école et au Directeur de gérer sa structure et ses utilisateurs.

**Livrables** :
- **Back-office SUPER_ADMIN** :
  - `/super-admin` — liste des établissements + cartes KPI.
  - `/super-admin/etablissements/nouveau` — création d'un établissement + provisioning du compte Directeur (Supabase Auth → invitation email).
  - `/super-admin/etablissements/[id]` — détail école (info, abonnements, utilisateurs).
  - `/super-admin/abonnements` — console abonnements : lecture par école, création, validation manuelle des paiements, suspension.
- **Gestion cycles** : `/etablissement/cycles`, activation par le Directeur (catalogue système seedé via `supabase/migrations/0003_seed_catalogues.sql`).
- **Gestion années scolaires** : `/etablissement/annees-scolaires` (+ page de détail `[id]`), statuts PREPARATION / ACTIVE / TERMINEE, contrainte une seule ACTIVE par école (enforced en base).
- **Gestion classes** — structure ✅ / tarifs ⏸️ : `/etablissement/classes` (+ page de détail `[id]`), niveau + série optionnelle (lycée, cascade cycle→niveau→série) + année scolaire + capacité. **Tarifs par classe volontairement différés à la Phase 6** (Finances) — `TypeFrais`/`TarifScolaire` n'existent pas encore, décision actée pour ne pas dupliquer le travail avec le domaine financier complet.
- **Gestion utilisateurs** (par le Directeur) :
  - `/utilisateurs`, `/utilisateurs/inviter`, `/utilisateurs/[id]` — 5 rôles fixes, invitation / activation via Supabase Auth, désactivation.
  - `/profil` — configuration du PIN d'approbation (step-up auth) pour Directeur/Secrétaire.
- Matrice de permissions par rôle (accès lecture seule croisés selon doc 03) — non implémentée en UI dédiée ; appliquée via `requireRole()` par page/action (pas de système de permissions dynamique, conforme CLAUDE.md).
- Composants UI réutilisables ajoutés : `Select`/`DatePicker`/`Calendar` (Radix + react-day-picker, remplacent les `<select>`/`<input type="date">` natifs non stylables), `StatCard`, badges en pastille.
- Tests E2E Playwright (`e2e/auth-guard.spec.ts`) : garde d'authentification sur toutes les routes protégées de la phase, rendu de `/login`, échec de connexion, `/forgot-password`. Parcours **authentifiés** (SUPER_ADMIN/Directeur) validés manuellement — pas encore automatisés faute de comptes de test dédiés en CI (à faire quand des comptes de test seront provisionnés).

**Dépend de** : Phase 0.

**DoD** — validé le 2026-08-18 : parcours complet « SUPER_ADMIN crée l'école → crée le Directeur → Directeur invite une Secrétaire → Directeur crée une année active → crée des classes » testé manuellement ; permissions vérifiées par rôle via `requireRole()` ; garde d'authentification couverte par tests E2E Playwright (parcours authentifiés couverts manuellement, à automatiser une fois des comptes de test provisionnés).

---

### Phase 2 — Élèves, responsables légaux & inscriptions

**Objectif** : gérer la population scolaire et son inscription annuelle.

**Livrables** :
- [x] CRUD **Élève** : matricule auto `ELV-{annee}-{seq}` par établissement et par année scolaire, `ancien_matricule`, statuts.
- [x] **Responsables** + relation N–N `EleveResponsable` (lien de parenté, principal).
- [x] **Inscription** : élève × année × classe, règle d'unicité (une inscription ACTIVE par élève par année), décision de fin d'année (ADMIS / REDOUBLANT / DEPART).
- [x] **Génération automatique de la FactureEleve** à l'inscription : lignes auto depuis les `TarifScolaire` de la classe (squelette à 0 si aucun tarif configuré). L'édition des lignes par le Comptable avant validation reste différée à la Phase 6 (Finances) — décision produit documentée dans le plan de Phase 2.
- [x] **Passage automatique en fin d'année** : le système propose le passage des élèves admis selon `niveau_suivant_id` ; le Directeur/Secrétaire valide ou ajuste élève par élève.
- [x] **Import Excel** élèves + responsables : upload → gabarit de colonnes fixe → validation Zod → rapport d'erreurs ligne par ligne → import transactionnel.

**Dépend de** : Phase 1.

**DoD** : inscrire un nouvel élève (facture auto générée), importer une liste Excel, passer une cohorte d'une année à l'autre ; rapport d'import lisible ; tests sur les règles d'unicité et le calcul du solde facture.

---

### Phase 3 — Enseignants & affectations pédagogiques

**Objectif** : savoir qui enseigne quoi, à qui, quand.

**Livrables** :
- [x] CRUD **Enseignant** : matricule auto `ENS-{annee}-{seq}` par établissement et par année scolaire, statuts.
  - [x] Compte Supabase Auth **obligatoire** pour tout enseignant — email requis à la création, invitation Supabase Auth envoyée automatiquement.
- [x] **AffectationEnseignant** : enseignant × classe × matière × année scolaire.
  - L'affectation contrôle les droits de saisie de notes (un prof ne saisit que ses affectations) — vérification effective de la saisie différée à la Phase 4, périmètre de lecture posé dès Phase 3.
- [x] **TitulariteClasse** : 0 ou 1 titulaire par classe.
- [x] Import Excel enseignants + affectations.

**Dépend de** : Phases 1–2 (peut avancer en parallèle de Phase 4 sur les matières).

**DoD** : affecter un prof polyvalent (plusieurs matières, même classe) et un prof multi-classes ; un enseignant connecté ne voit que ses classes/matières affectées ; tests de périmètre d'accès.

---

### Phase 4 — Domaine académique (le moteur)

**Objectif** : matières, coefficients, notes et calcul fiable des moyennes.

**Livrables** :
- [x] **Matières** personnalisables par établissement (`/etablissement/matieres`, service `matiere.ts` étendu en Phase 4). Catalogue standard activable : non fait (pas de catalogue système de matières pré-seedé — seulement la création manuelle par établissement, jugé suffisant pour le MVP).
- [x] **ProgrammeEtablissement** : niveau × matière, obligatoire/facultatif, ordre d'affichage (`/etablissement/programme`, service `programme.ts`).
- [x] **CoefficientMatiere** : programme + série optionnelle + `annee_scolaire_id`, historisé dès v1 — même année = update, nouvelle année = nouvelle ligne (`/etablissement/programme/coefficients`, service `coefficient.ts`).
- [x] **Évaluations** : INTERROGATION (max 3/période), DEVOIR, COMPOSITION ; trimestres T1/T2/T3 ; contrainte d'unicité (classe + matière + type + période + numéro). UI enseignant : `/etablissement/notes/saisie` (sélection classe/matière/période limitée aux affectations actives + création d'évaluation).
- [x] **Notes** + **moteur de calcul** en cascade (couvert par 29 tests unitaires dans `calcul-moyennes.test.ts`, écrits avant l'UI) :
  - Moy. interros = somme / nombre saisis (si 0 interro : composante ignorée)
  - Moy. classe = (moy. interros + devoir) / 2 (si composante manquante : calcul sur ce qui existe)
  - Moy. matière = (moy. classe + composition) / 2
  - Moy. trimestrielle = Σ(moy. matière × coeff) / Σ(coefficients) — matières facultatives sans note exclues
  - Moy. annuelle = (T1 + T2 + T3) / 3
  - Arrondi : 2 décimales
  - Saisie/soumission : `/etablissement/notes/saisie/[evaluationId]` (grille élève × note, brouillon puis soumission, bascule en lecture seule "verrouillé" une fois soumis).
- [x] **Appréciations automatiques** (9 tranches de 0 à 20, doc 07 §11 — bug de tranches/libellés corrigé dans le scaffold existant `appreciation()` pour matcher exactement la doc).
- [x] **Classement** par moyenne générale (`classement()` du moteur pur, exposé via `getClassementClasse`). Par matière : la fonction `classement()` est générique et réutilisable par matière, mais aucun écran dédié au classement par matière n'a été construit (seul `/etablissement/notes/resultats` affiche le classement général) — à compléter si besoin en Phase 5 pour les bulletins.
- [x] **Cycle de validation des notes** :
  - `BROUILLON` : saisie libre par l'Enseignant
  - `SOUMISE` : note prise en compte dans les calculs
  - `EN_ATTENTE` : modification post-soumission demandée → file d'approbation Secrétaire
  - `VALIDE` / `REJETE` : après action Secrétaire avec PIN
- [x] **Interface d'approbation** pour la Secrétaire (et le Directeur) : page listant les notes `EN_ATTENTE` avec contexte complet (élève, classe, matière, évaluation, ancienne/nouvelle valeur, demandeur), modal PIN avec actions Approuver / Rejeter (motif), confirmation post-action. (Note : implémentée en page dédiée `/etablissement/notes/approbation`, pas en modal à la connexion — le déclenchement "modal à la connexion" reste à faire si souhaité dans un futur milestone.)

**Dépend de** : Phases 1–3.

**DoD** : batterie de tests unitaires sur le moteur de calcul (cas normaux + cas limites : 0 interro, matière facultative sans note, période incomplète, coeff 0) **avant** l'UI ; cycle complet saisie → soumission → demande de modification → approbation Secrétaire avec PIN → audit loggé.

---

### Phase 5 — Documents : bulletins & reçus (PDF) — ✅ TERMINÉE (2026-08-19)

**Objectif** : produire les documents officiels.

**Livrables** :
- [x] **Bulletin** trimestriel PDF — contenu complet (doc 09) : en-tête école, en-tête élève, tableau des résultats par matière (moyennes, coefficients, rang matière, professeur), synthèse (moyenne générale, rang, statistiques classe, moyenne annuelle best-effort), zone de signature physique. (Note : la colonne "appréciation du professeur" de la maquette est un texte libre par matière qui n'existe dans aucun modèle de données — Phase 4 n'a défini qu'une appréciation globale automatique via `appreciation()`. Le bulletin affiche donc le nom du professeur par matière plutôt qu'un texte d'appréciation par matière ; l'appréciation générale automatique reste affichée dans la synthèse.)
  - [x] Même format pour tous les niveaux (maternelle, primaire, collège, lycée) — barème /20.
- [x] **Reçu de paiement** PDF (template + `genererRecuPaiement(paiementId)`, sans écran de saisie — l'enregistrement de paiement reste Phase 6, décision actée avec l'utilisateur en Phase 5, même schéma que les tarifs différés en Phase 1/2).
- [x] Entité `Document` (référence, type, objet lié, statut GENERE / OBSOLETE / ARCHIVE) + stockage dans Supabase Storage (migration `0007_phase5_storage_bucket.sql` — bucket `documents` privé, **appliquée sur le projet distant le 2026-08-19** via `npx supabase db push --include-all`, en même temps que 0003 à 0006 qui avaient été exécutées à la main sans être enregistrées dans l'historique de migrations).
- [x] **Numérotation par établissement et par année scolaire** : `BUL-{annee}-{seq}`, `REC-{annee}-{seq}` ; l'année = année de début de l'année scolaire (réutilise `generateNumeroDocument`, Phase 0).
- [x] Régénération possible d'un bulletin existant (produit le même résultat si aucune donnée sous-jacente n'a changé) : l'ancien document passe `OBSOLETE`, le nouveau est créé `GENERE` — jamais de suppression.
- [x] Audit de génération tracé dans `AuditLog` (`GENERER_BULLETIN` / `REGENERER_BULLETIN` / `GENERER_RECU`).

**Dépend de** : Phase 4 (bulletins), Phase 2 (factures/reçus via Phase 6).

**DoD** : bulletin généré conforme au design ; régénération donne un document identique ; numérotation cohérente et séquentielle par école ; audit de génération présent.

**Validation manuelle (2026-08-19)** : parcours réel exécuté sur un build de production (port 3100) contre le projet Supabase distant, avec un compte SECRETAIRE de test et le jeu de données de démonstration (`npm run seed:demo`) — génération d'un bulletin depuis `/etablissement/notes/bulletins` (6ème A, 1er trimestre), régénération depuis `/etablissement/eleves/[id]/bulletins`. Constaté : PDF valides d'une page (~81 Ko) déposés dans le bucket, numérotation séquentielle `BUL-2025-000001` → `000004`, ancien document passé `OBSOLETE` à la régénération, entrées `GENERER_BULLETIN` / `REGENERER_BULLETIN` dans `audit_log`, et taille identique à un octet près entre deux générations du même bulletin (seule la date de génération diffère). Ce parcours a révélé un blocage que les tests unitaires ne pouvaient pas voir (`getEtablissement` mocké) : `getEtablissement` était gardé par `requireRole()` sans argument, donc réservé au SUPER_ADMIN, alors que `genererBulletin` et `genererRecuPaiement` en ont besoin pour l'en-tête du document — toute génération par un Directeur, une Secrétaire ou un Comptable échouait avec « Accès refusé ». Corrigé : lecture ouverte aux rôles école, restreinte à leur propre établissement.

**Reste à valider en Phase 6** : le reçu (`genererRecuPaiement`) n'a pas d'écran en Phase 5 par décision de périmètre, donc son parcours réel n'est couvert que par ses tests unitaires ; il emprunte le même pipeline que le bulletin (numérotation, upload, `Document`, audit), désormais validé de bout en bout, et bénéficie du correctif `getEtablissement` ci-dessus.

**Note d'implémentation** : le rendu PDF réel (Playwright + Chromium headless) a été vérifié manuellement pendant l'implémentation — `npx playwright install chromium` a réussi et un appel Node direct produit un buffer PDF valide. Le test Vitest correspondant (`src/lib/pdf/__tests__/render.test.ts`) est gardé derrière `RUN_PDF_TESTS=1` : dans le pool de workers Vitest de cet environnement de développement, le lancement de Chromium comme sous-processus imbriqué bloque indéfiniment ou fait planter le worker (artefact de sandboxing de l'environnement, pas du code) — voir commentaire en tête du fichier de test.

---

### Phase 6 — Finances de l'établissement — ✅ TERMINÉE (2026-08-19)

**Objectif** : facturer les élèves et encaisser.

**Livrables** :
- [x] **TypeFrais** : catégories de frais par établissement (`/etablissement/finances/types-frais`). Jamais supprimé (les factures historiques le référencent) — désactivable via `statut`.
- [x] **TarifScolaire** (par classe × TypeFrais × AnneeScolaire) — **immuable après création** (`/etablissement/finances/tarifs`). Il n'existe volontairement aucune fonction `updateTarif`/`deleteTarif` dans `src/services/tarif.ts` : la contrainte unique DB empêche en plus de contourner l'immuabilité par un doublon.
- [x] **FactureEleve** + **LigneFacture** — auto-générée à l'inscription depuis la Phase 2 (`fn_inscrire_eleve`) ; lignes ajustables par le Comptable (remises, frais spéciaux) via `fn_modifier_lignes_facture`, qui remplace la liste complète et recalcule total + statut en une transaction.
- [x] **Paiement** en plusieurs tranches : tous les modes, solde calculé, statuts informatifs — **aucun blocage système**. Une référence est exigée hors espèces (sans elle un chèque ou un Mobile Money n'est pas rapprochable).
- [x] Annulation de paiement : statut `ANNULE` + recalcul du statut de la facture, jamais de suppression. Un motif est demandé et journalisé.
- [x] Reçu PDF généré via le service Phase 5, depuis la facture détaillée.
- [x] Import de l'historique financier avec validation (`/etablissement/finances/import`), gabarit `matricule | montant | date_paiement | mode_paiement | reference`. Chaque ligne passe par la même RPC qu'une saisie manuelle : un import n'est pas une porte dérobée aux contrôles métier.
- [x] Accès par rôle : COMPTABLE (lecture + écriture), DIRECTEUR (lecture), SECRETAIRE (lecture seule), ENSEIGNANT (aucun accès).

**Dépend de** : Phases 1–2.

**DoD** : inscrire un élève → facture auto générée → Comptable ajuste une ligne → enregistrer 3 paiements partiels → générer reçu → annuler un paiement (mouvement inverse tracé) ; jamais de suppression dans `AuditLog`.

**Décisions d'implémentation** :
- *Point de non-retour des lignes de facture* : le doc 08 §8 parle d'ajustements « avant validation de la facture », mais `facture_eleve` (0001_init.sql) n'a pas d'état BROUILLON/VALIDE. Plutôt que d'ajouter un état au schéma, le **premier encaissement** fait office de validation : au-delà, les lignes sont figées (règle portée par `fn_modifier_lignes_facture`, pas seulement par l'UI). Cela évite qu'un total change sous des reçus déjà remis aux familles.
- *Écriture financière réservée au Comptable* : le doc 08 §17 donne au Directeur une « lecture complète » seulement, ce qui est appliqué à la lettre. Conséquence à connaître : une école sans utilisateur COMPTABLE ne peut rien encaisser — si cela pose problème en exploitation, c'est une décision produit à trancher, pas un contournement à improviser dans le code.
- *Dépassement du solde refusé* : `fn_enregistrer_paiement` rejette un versement supérieur au reste dû. Sans notion d'avoir ni de remboursement au MVP, un tel montant est presque toujours une faute de frappe.
- *Atomicité en base* : versement, annulation, édition de lignes et annulation de facture passent par des RPC `security invoker` (`0008_phase6_finance_rpc.sql`) — un enchaînement de requêtes REST laisserait une fenêtre où le statut de la facture ne correspond plus à ses paiements.

**Validation manuelle (2026-08-19)** : parcours réel sur un build de production (port 3100) contre le projet Supabase distant, connecté avec le compte COMPTABLE de démonstration — suivi des paiements (276 factures), ouverture d'une facture PARTIEL (solde 78 000), encaissement de 500 FCFA en espèces (solde 77 500, statut recalculé), génération du reçu `REC-2025-000001` (PDF valide, 70 Ko), puis annulation du versement (statut `ANNULE`, solde revenu à 78 000). Les trois actions `ENREGISTRER_PAIEMENT`, `GENERER_RECU` et `ANNULER_PAIEMENT` sont présentes dans `audit_log`.

Ce parcours a révélé un bug invisible en test automatisé : les champs montant portaient `step={500}` avec `min={1}`, donc la validation HTML5 du navigateur **bloquait silencieusement** la soumission de tout montant qui n'était pas `1 + k×500` — aucun POST n'était émis, aucun message affiché. Corrigé en `step={1}` sur les trois formulaires de montant (versement, tarif, lignes de facture). Leçon générale : sur un champ monétaire, ne jamais utiliser `step` comme suggestion d'incrément — c'est une contrainte de validation.

---

### Phase 7 — Abonnement SaaS (côté plateforme) — ✅ TERMINÉE (2026-08-19)

**Objectif** : gérer la relation commerciale plateforme ↔ écoles.

**Livrables** :
- [x] **PlanAbonnement** (mensuel / annuel), **AbonnementEtablissement**, **PaiementAbonnement** — strictement séparés des finances école (tables, services et écrans distincts ; `paiement_abonnement` n'est jamais joint à `paiement`).
- [x] Statuts : ACTIF / EXPIRE / SUSPENDU — **pas de statut ESSAI**. L'expiration est constatée par `fn_expirer_abonnements()` et, en lecture, déduite de la date par `statutEffectif()` — un abonnement échu est traité comme expiré même si le balayage n'a pas encore tourné.
- [x] **Console SUPER_ADMIN** : suivi par école avec statut effectif et jours restants, validation manuelle d'un paiement, suspension, **réactivation** et **renouvellement** (choix du plan à cette occasion, ce qui permet la conversion mensuel → annuel).
- [x] **Comportement à l'expiration** — la question laissée ouverte par le doc 08 §22 et Q15 d'`analysis.md`, tranchée ici (voir ci-dessous).

**Dépend de** : Phase 1.

**DoD** : cycle « SUPER_ADMIN crée école → abonnement ACTIF → SUPER_ADMIN valide paiement manuel → renouvellement → expiration → suspension » ; séparation financière stricte vérifiée.

**Décision — effet de l'expiration** (`src/services/abonnement-acces.ts`) : quatre niveaux d'accès.

| Niveau | Déclencheur | Effet |
|---|---|---|
| OK | actif, plus de 30 jours restants | rien |
| AVERTISSEMENT | actif, échéance dans 30 jours ou moins | bandeau, aucun blocage |
| LECTURE_SEULE | EXPIRE, ou aucun abonnement enregistré | consultation et documents accessibles, écritures refusées |
| BLOQUE | SUSPENDU | accès applicatif fermé, redirection vers `/abonnement` |

Le principe retenu : **ne jamais prendre les données de l'école en otage**. Une école qui n'a pas payé perd le droit d'écrire, pas celui de consulter ni d'imprimer les bulletins de ses élèves. C'est aussi le choix commercialement sain — une école bloquée en pleine session d'examens résilie, une école en lecture seule appelle pour payer. La suspension est plus stricte parce qu'elle est une décision explicite du SUPER_ADMIN, pas un oubli d'échéance.

**Point d'application du verrou** : le middleware (`src/lib/supabase/middleware.ts`). C'est le seul passage commun à toutes les écritures — les Server Actions de Next arrivent en POST sur la route courante. Filtrer là évite d'ajouter une garde dans chacun des services mutateurs, et surtout d'en oublier un. Le coût est maîtrisé : la lecture de l'abonnement n'a lieu que sur les requêtes non-GET et sur les navigations vers l'espace école. `/abonnement`, `/profil` et les routes d'authentification restent toujours accessibles — enfermer un directeur hors de sa page d'abonnement le priverait du moyen de régulariser. Le SUPER_ADMIN n'est jamais restreint.

**Renouvellement** : `fn_renouveler_abonnement` crée la période suivante sans jamais modifier la précédente (même logique d'historisation que les tarifs scolaires). Elle démarre à la fin de l'ancienne si celle-ci est à venir (pas de jour perdu), sinon aujourd'hui (pas de période rétroactive facturée). Le nouvel abonnement naît **SUSPENDU** : l'accès n'est ouvert qu'à la validation du paiement, conformément au processus manuel du doc 08 §21.

**Validation manuelle (2026-08-19)** : l'abonnement de l'établissement de démonstration arrivait justement à échéance ce jour-là, ce qui a fourni un cas réel sans manipulation de données. Constaté sur un build de production : bandeau « lecture seule » affiché, consultation du suivi des paiements intacte (276 factures), tentative d'encaissement **refusée en 403** par le middleware, page `/abonnement` accessible et affichant `EXPIRE`. Puis `fn_expirer_abonnements` (1 abonnement basculé), `fn_renouveler_abonnement` vers le plan annuel (période 2026-08-19 → 2027-08-19, créée SUSPENDU), validation du paiement → `ACTIF` : bandeau disparu, écriture de nouveau acceptée (POST 200), formulaire de création de tarif réapparu.

**Note d'ergonomie** : les écrans finance masquent leurs commandes d'écriture quand l'accès est en lecture seule (`peutEcrire()`), pour ne pas laisser cliquer un bouton qui renverrait 403. Le reste de l'application s'appuie encore uniquement sur le bandeau et le refus middleware — généraliser ce masquage est un point à traiter en Phase 11 (design et améliorations).

**Note d'infrastructure** : `fn_expirer_abonnements` est en `security definer`, contrairement aux RPC des phases précédentes. Les policies de `abonnement_etablissement` réservent l'écriture au SUPER_ADMIN, or l'expiration doit pouvoir être constatée sans qu'un SUPER_ADMIN soit connecté. La fonction ne fait qu'une transition dictée par la date et ne prend aucun paramètre, elle ne peut donc pas servir à élever des privilèges. Sans planificateur dans le MVP, elle est appelée à l'ouverture de la console plateforme.

---

### Phase 8 — Dashboard, rapports & exports — ✅ TERMINÉE (2026-08-19)

**Objectif** : transformer les données en pilotage.

**Livrables** :
- [x] **Dashboard par rôle** (`/dashboard`, remplace la page de debug de la Phase 0) : DIRECTEUR (élèves, classes, enseignants, finance, académique + flux d'activité), COMPTABLE (attendu / encaissé / reste à recouvrer, taux de recouvrement), SECRETAIRE (inscriptions, notes à approuver, bulletins), ENSEIGNANT (ses classes, ses matières, ses évaluations, ses notes en brouillon). Chaque rôle a sa propre fonction de service : un Comptable ne déclenche pas les requêtes académiques et un Enseignant ne déclenche jamais de requête financière — le périmètre se joue dans le service, pas dans le JSX.
- [x] **Flux d'activité Directeur** — informatif uniquement (doc 09 §12), construit depuis `audit_log`.
- [x] **Rapports** : liste élèves, liste enseignants, effectifs par classe, état des paiements, résultats par classe (`/rapports`).
- [x] **Exports** Excel / CSV / PDF avec périmètre par rôle (doc 09 §9), via `/api/rapports/export`.

**Dépend de** : Phases 2–7.

**DoD** : chaque rôle voit uniquement son périmètre ; chiffres du dashboard réconciliés avec les données sources ; exports testés avec des données réelles.

**Décisions d'implémentation** :
- *Une forme unique de rapport* (`src/lib/export/rapport.ts`) : titre, colonnes, lignes, totaux. La même structure alimente l'aperçu à l'écran et les trois formats. Ajouter un rapport, c'est écrire une fonction et déclarer ses rôles — il devient exportable dans les trois formats sans code supplémentaire.
- *Matrice d'accès dans le service*, pas dans l'UI : `RAPPORTS` porte les rôles autorisés et `construireRapport` applique `requireRole` à partir de cette déclaration. Un export est un accès aux données comme un autre.
- *Route Handler plutôt que Server Action pour le téléchargement* : une Server Action renvoie une valeur sérialisée à React, pas un fichier avec ses en-têtes. La route renvoie directement un `Content-Disposition: attachment`, sans faire transiter un binaire en base64 dans le payload RSC.
- *CSV en points-virgules avec BOM UTF-8* : c'est ce qu'attend Excel en configuration française. Sans cela, les accents sont cassés et toutes les colonnes atterrissent dans la première.

**Validation manuelle (2026-08-19)** : parcours réel sur un build de production avec les trois comptes de démonstration. Tableaux de bord conformes par rôle (Comptable : 67 800 000 F attendus, 46 634 500 F encaissés, 130/270 factures soldées). Exports Excel réellement téléchargés pour le Comptable et la Secrétaire. Périmètre vérifié côté API : Secrétaire → export `PAIEMENTS` **403**, Enseignant → export `ELEVES` **403**, Enseignant → `RESULTATS` sur sa classe **200** (données réelles), sur une classe hors de ses affectations **403**.

Ce parcours a révélé trois défauts, tous corrigés :
1. **`listAnneesScolaires` excluait l'ENSEIGNANT**, ce qui faisait échouer en 500 non seulement `/rapports` mais aussi `/etablissement/mes-classes` et `/etablissement/notes/saisie` — donc l'espace enseignant en entier, depuis les Phases 3-4. La lecture des années scolaires est désormais ouverte à ce rôle (catalogue interne sans donnée sensible dont tous ses écrans dépendent).
2. **`/rapports` appelait `listClasses`** pour peupler le sélecteur, réservé aux rôles administratifs. Le sélecteur de l'enseignant est maintenant construit depuis ses affectations — ce qui est de toute façon le périmètre que le rapport lui autorise.
3. **Le rapport « Résultats par classe » dépassait 60 secondes** : il s'appuyait sur `getClassementClasse`, qui appelle `getMoyennesEleve` élève par élève (N+1 de requêtes vers une base distante). Il est réécrit en chargement groupé — programme, coefficients, évaluations et notes en cinq requêtes, puis calcul en mémoire via les fonctions pures de `calcul-moyennes.ts` (aucune règle de calcul réimplémentée). Mesuré : **60 s+ → 7 s** pour une classe de 18 élèves.

**À traiter en Phase 10** : `getClassementClasse` (Phase 4) ne vérifie que le rôle et laisserait un enseignant lire le classement d'une classe qui n'est pas la sienne. La restriction est appliquée dans le rapport, mais elle mérite d'être portée par le service lui-même. Son N+1 subsiste aussi pour l'écran `/etablissement/notes/resultats`.

---

### Phase 8.5 — Refonte UX/UI, performance et corrections métier — 🚧 EN COURS (2026-08-20)

**Origine** : retours d'usage manuels consignés dans `remarques_avant_phase9.txt` (2026-08-20),
après passage complet sur les rôles Directeur, Secrétaire, Enseignant et Comptable.
La Phase 9 (durcissement & mise en production) est **décalée après cette phase** : elle gèle
un état (revue de sécurité, matrice de permissions, E2E des parcours critiques, go/no-go), et
geler avant la refonte reviendrait à la repayer intégralement.

**Périmètre** : correctifs et mise en conformité. Les *améliorations* (nouveaux graphiques,
animations décoratives, refonte d'ergonomie non signalée) restent hors périmètre et passent
après la mise en production.

#### Lot 1 — Fondations design system

Tout le reste en dépend ; à faire en premier.

- **Toasts** : composant `Toaster` global + hook `useToast` (succès / erreur / info). Aucune
  confirmation n'est aujourd'hui remontée à l'utilisateur autrement que par un rechargement muet.
- **Modal flottant réutilisable** (`Dialog` Radix) — base des formulaires « nouveau X »,
  du PIN et des confirmations.
- **Boutons** : corriger la couleur de texte sur fonds bleu et rouge (contraste illisible),
  renforcer les états `hover`/`active`, ajouter un état `pending` (spinner) piloté par
  `useFormStatus` pour tout bouton de soumission.
- **Hover** : remonter le contraste des survols (lignes de tableau, items de sidebar, cartes) —
  actuellement le changement de couleur est à peine perceptible.
- **Scrollbar** personnalisée alignée sur les tokens `Luminous Institutional`.
- **États de chargement** : `loading.tsx` par segment de route + squelettes de tableau, pour
  ne plus laisser un écran figé pendant les 3–6 s d'un aller-retour Supabase.
- **DatePicker** : navigation par mois/année (sélecteurs) pour atteindre une date éloignée
  (dates de naissance) sans cliquer mois par mois.

#### Lot 2 — Performance

Une action prend aujourd'hui 3 à 6 s, ce qui n'est pas exploitable.

- Profiler les écrans les plus lents et supprimer les requêtes en cascade restantes
  (même traitement que le correctif Phase 8 sur « Résultats par classe » : 60 s → 7 s).
- `/etablissement/notes/resultats` **ne s'affiche jamais** (compile puis reste bloqué) —
  N+1 de `getClassementClasse` encore présent sur cet écran. Bloquant.
- Mutualiser les lectures répétées (`getTenantContext`, année active, établissement) via
  `React.cache` sur la durée d'une requête.
- Revue des index Postgres sur les colonnes de filtre les plus sollicitées.
- Perception : `useOptimistic` / `router.refresh()` ciblé plutôt que rechargement complet.

#### Lot 3 — Navigation et information architecture

- **Sidebar** : ramener à 5–6 entrées par rôle (aujourd'hui jusqu'à 18 pour le Directeur),
  avec icône sur chaque entrée, et `Paramètres` + `Aide` en sticky en bas.
- Chaque entrée regroupante ouvre une **page d'accueil de section** listant ses
  fonctionnalités en blocs (ex. `Élèves` → inscriptions, facturation, responsables).
- `Mon abonnement` sort de la sidebar (profil ou section Établissement).
- **Header** : supprimer le second « ScolarGest » (doublon du sidebar), le remplacer par une
  **barre de recherche globale dynamique** ; ajouter `Paramètres`, `Aide`, `Notifications`
  en icônes à côté du profil, avec les pages correspondantes rattachées au profil.

#### Lot 4 — Listes : pagination, recherche, tri, filtres

Transversal à toutes les listes de la plateforme.

- **Pagination** ~10 lignes par page, navigation horizontale par boutons directionnels, de
  sorte qu'aucune liste n'oblige à scroller pour atteindre la dernière ligne ni les actions
  situées en dessous (cas bloquant constaté sur `Tarifs` : « Nouveau tarif » inatteignable).
- **Recherche dynamique** + **tri** + **filtres** sur chaque liste.
- **Masquer le matricule** dans les listes ; il reste sur la fiche de l'élève.

#### Lot 5 — Step-up PIN et modales de formulaire

- Généraliser la **demande de PIN** sur les actions irréversibles ou sensibles : activation
  d'un cycle (verrouillage définitif), activation d'une année scolaire, et l'ensemble des
  actions d'approbation listées au doc 03. Aujourd'hui le PIN n'est demandé quasiment nulle part.
- **Profil** : la section « PIN de confirmation » devient discrète et ouvre un modal flottant.
- Les pages `/nouvelle` deviennent des **modales flottantes** (année scolaire, classe,
  inscription d'un élève, etc.).

#### Lot 6 — Corrections métier

- **Années scolaires** : une année ne doit plus passer automatiquement à `TERMINEE`.
  Concevoir un **flux de clôture d'année** explicite (à spécifier avant implémentation).
- **Classes** : le nom devient une **composition guidée** `Niveau + Série + Indice (A, B, …)`
  au lieu d'une saisie libre ; compléter la liste des séries (une série manque).
- **Élèves** : sortir le passage de cohorte de la section Élèves et le refondre **par classe**
  (avec une option « faire passer tous les admis ») ; rendre la section « Responsables légaux »
  modifiable ; dans « Facturation », remplacer l'ouverture implicite de la facture par un bouton.
- **Programme & coefficients** : supprimer la colonne « ordre d'affichage » (inutile) ; rendre
  la gestion des coefficients visible ; remplacer l'enregistrement matière par matière.
  **Bug** : au changement de série, les coefficients affichés conservent les valeurs de la
  série précédente au lieu de charger les leurs.
- **Approbation des notes** : les notes soumises par un enseignant ne génèrent **aucune**
  demande d'approbation visible. À corriger, et à recentrer sur la **Secrétaire** seule —
  le Directeur n'intervient pas sur les notes (doc 03).
- **Dashboard Directeur** : donner du corps à « Activité récente » ; « Recouvrement » occupe
  beaucoup d'espace pour peu d'information — graphique ou format compact.
- **Dashboard Secrétaire** : raccourcis en blocs ; « Inscrire un élève » en modal.

#### Lot 7 — Bulletin Collège/Lycée

Reproduire **à l'identique** le modèle officiel fourni (`Bulletin_LOKI_KILO.pdf`, format
Ministère des Enseignements Primaire et Secondaire / République Togolaise) : en-tête à trois
colonnes, encart Sexe/Statut, tableau des matières (Moy. Classe, Compo, Moy. Géné, Coef, Note
Définitive, Rang, Appréciation, Nom du professeur, Signature), bloc absences/retards/punitions/
exclusions, tableau d'honneur / félicitations / encouragements / avertissement / blâme,
rappel des moyennes, moyenne la plus forte et la plus faible, décision du conseil, observation
du chef d'établissement et signatures.
Le modèle **Collège/Lycée uniquement** : les autres cycles conservent le gabarit actuel.

**DoD** : build / lint / typecheck / unit / E2E verts ; parcours manuel repassé sur les quatre
rôles ; aucun point de `remarques_avant_phase9.txt` non traité ou non explicitement reporté.

---

### Phase 9 — Durcissement & mise en production

**Objectif** : passer d'un produit fonctionnel à un produit livrable.

**Livrables** :
- **Revue de sécurité** :
  - Isolation tenant testée par tentative d'accès croisé entre écoles.
  - Vérification des permissions par rôle (matrice complète).
  - Step-up auth (PIN) testé sur toutes les actions d'approbation.
- Couverture `AuditLog` complète sur toutes les actions listées dans le doc 03.
- Tests E2E des parcours critiques (inscription, paiement, note, bulletin, approbation).
- Tests de charge légers (simulation multi-école).
- Sauvegardes automatiques (Supabase), journalisation, monitoring.
- **Procédure d'onboarding** : checklist de configuration d'une nouvelle école par notre équipe (cycles, année, classes, tarifs, utilisateurs, import données initiales).

**DoD** : checklist de sécurité passée ; une école réelle configurée de bout en bout depuis la checklist d'onboarding ; go/no-go documenté.

---

## 4. Chemin critique & parallélisation

```
Phase 0
    │
    ▼
Phase 1 ──► Phase 2 ──► Phase 3 ─┐
    │                             ├─► Phase 4 ──► Phase 5
    │                             │
    └──────────────► Phase 6 ─────┘
    │
    └──────────────► Phase 7

Phases 2–7 ──► Phase 8 ──► Phase 8.5 ──► Phase 9
```

**Parallélisation possible** une fois Phase 1 stable :
- **Finance école** (Phase 6) et **Académique** (Phases 3–4) peuvent avancer en parallèle — ils ne partagent que les élèves et la structure.
- **Abonnement SaaS** (Phase 7) est indépendant des phases 2–6.

---

## 5. Jalons produit

| Jalon | Phases | Contenu |
|---|---|---|
| **A — MVP vendable** | 0 → 6 | Élèves, classes, enseignants, notes, bulletins, factures, reçus |
| **B — SaaS commercial** | + 7–8 | Abonnements, dashboard, rapports, exports |
| **C — Production** | + 9 | Sécurité renforcée, onboarding, monitoring |

Priorité marché : **collège** — c'est le segment le plus stable et le premier cible commerciale.

---

## 6. Questions résolues — aucun bloquant restant

Toutes les questions de `analysis.md` (Q0–Q17) sont tranchées. Les phases peuvent démarrer dans l'ordre défini sans attendre de décision.

Rappel des décisions clés impactant le développement :

| Décision | Impact |
|---|---|
| Supabase Auth + PIN step-up | Phase 0 : `pin_approbation_hash` dans `Utilisateur`, claims via Auth Hooks |
| Isolation applicative (pas RLS) | Phase 0 : repository pattern obligatoire partout |
| Compte enseignant obligatoire | Phase 3 : email requis, invitation Supabase Auth automatique |
| Tarifs par classe (immuables) | Phase 6 : `classe_id` dans `TarifScolaire` |
| Facture auto à l'inscription | Phase 2 + 6 : génération à la validation de l'inscription |
| Coefficients historisés dès v1 | Phase 0 : `annee_scolaire_id` dans `CoefficientMatiere` |
| Barème /20 universel | Phase 4 : un seul moteur de calcul |
| Pas de mode hors-ligne | Phase 9 supprimée — pas de PWA ni PowerSync |
| Numérotation par établissement/année | Phases 2, 5, 6 : séquences isolées |
| Passage automatique via `niveau_suivant_id` | Phase 0 (schéma) + Phase 2 (UI) |

---

## 7. Workflow d'exécution d'une phase

> Objectif : qu'un seul prompt du type « on attaque la Phase N » suffise à obtenir une phase **conçue, implémentée, vérifiée et testée**, sans redécouvrir à chaque fois les pièges déjà rencontrés. Suivre les étapes dans l'ordre — ne pas sauter la vérification continue (étape 3) pour « gagner du temps », c'est justement ce qui coûte le plus cher plus tard.

### Étape 0 — Cadrage

- Relire la section de la phase concernée dans ce fichier (Objectif, Livrables, Dépend de, DoD).
- Lire les fichiers `Docs/0X-…` pertinents (voir table dans `CLAUDE.md`) — ne jamais implémenter une règle métier de mémoire, la vérifier dans la doc.
- Vérifier `analysis.md` pour toute décision (Q0–Q17) qui impacte la phase.
- Vérifier ce qui existe déjà en base (`supabase/migrations/*.sql`) et dans `src/services/` — ne jamais recréer un service ou une table qui existe déjà sous un autre nom.
- Repérer les maquettes concernées dans `/design-maquette` (voir convention dans `CLAUDE.md` § Design System).

### Étape 1 — Plan

- Utiliser `EnterPlanMode` dès que la phase touche plus de 2-3 fichiers ou qu'il y a un choix d'implémentation (c'est presque toujours le cas pour une phase entière).
- Découper la phase en **milestones verticaux** (une fonctionnalité utilisable de bout en bout à chaque étape), pas en couches horizontales (« tous les services », puis « toutes les pages »).
- Si un livrable de la phase déborde sur le domaine d'une autre phase (ex. tarifs de classe qui touchent la Finance) : le signaler explicitement dans le plan et proposer de différer, plutôt que d'improviser un bout de schéma en avance.
- Poser les questions de produit ouvertes via `AskUserQuestion` **avant** de coder, pas après — un scope mal calé coûte plus cher à corriger une fois écrit.

### Étape 2 — Implémentation

Conventions à respecter systématiquement (voir `CLAUDE.md` pour le détail) :
- Un fichier par domaine dans `src/services/`, jamais d'appel Supabase direct depuis une page/Server Action.
- Chaque service mutateur : garde `requireRole(...)` en première ligne + `auditLog()` sur les écritures sensibles.
- Pattern Server Action : `actions.ts` colocalisé au `page.tsx`, validation Zod, `FormData` en entrée, `redirect()` ou message d'erreur en sortie (voir `src/app/(auth)/login/actions.ts`).
- UI : réutiliser les composants de `src/components/ui/` (`Select`/`DatePicker` — jamais les éléments natifs, voir `CLAUDE.md`) ; comparer à la maquette du dossier correspondant avant de considérer une page terminée.
- RLS + filtre applicatif explicite (`etablissementId`) sur chaque requête, même si RLS suffirait seule (défense en profondeur, cf. CLAUDE.md).
- Toute nouvelle table de catalogue système (sans `etablissement_id`) : la seed correspondante doit vivre dans une **migration numérotée** (`on conflict` idempotent), pas seulement dans `supabase/seed.sql` — sinon elle ne sera jamais provisionnée sur un environnement distant (`db push` n'exécute pas `seed.sql`, seul `db reset` le fait). Piège déjà rencontré en Phase 1.

### Étape 3 — Vérification continue (à chaque milestone, pas seulement à la fin)

- `npm run build` et `npm run lint` après **chaque** milestone livré, pas en fin de phase — un échec de build découvert après 5 pages est 5x plus coûteux à isoler.
- Si un build échoue avec une erreur `Cannot find module './XXX.js'` ou similaire sans rapport avec le code modifié : cache `.next` corrompu (build précédent interrompu) — supprimer `.next` et relancer, ne pas chercher le bug dans le code.
- Si un correctif de style/couleur/texte semble ne jamais s'appliquer en dev alors que le code source est correct : suspecter un **cache webpack dev périmé** (serveur `npm run dev` resté ouvert trop longtemps, watcher qui a raté un changement). Vérifier en comparant le HTML réellement servi (`curl` sur une page publique, chercher les classes attendues) au code source — si ça ne correspond pas, c'est le cache, pas le code. Corriger : arrêter le serveur, supprimer `.next`, relancer.

### Étape 4 — Debug

- Ne jamais deviner un bug visuel/runtime sans le reproduire : lire le HTML/CSS réellement servi (`curl`, ou lecture du `.next/static/css/**` généré par un build de prod) plutôt que de relire le composant en boucle en espérant repérer l'erreur à l'œil.
- Un service qui écrit en base : tester d'abord la requête isolément (petit script Node avec le client `service-role`, voir pattern utilisé en Phase 1 pour diagnostiquer le catalogue `cycle` vide) avant de soupçonner la couche UI.
- Toute action qui écrit des données réelles ou envoie un email réel (invitation Supabase Auth, etc.) : ne jamais l'exécuter soi-même sans confirmation explicite de l'utilisateur — demander d'abord si l'environnement est dev/staging ou le seul projet existant.

### Étape 5 — Tests

- **Unitaires (Vitest)** : obligatoires avant toute UI pour la logique de calcul pure (moteur de notes en Phase 4, calcul de solde en Phase 6, génération de matricule/numéro de document) — cf. principe #7 de ce document.
- **E2E (Playwright)** :
  - Config dédiée avec un **port différent de celui du serveur de dev habituel** (ex. `3100`) et `command: npx next start -p 3100` sur un build déjà fait (`npm run build` séparé) — lancer `next dev` ou un `build && start` combiné dans `webServer` est plus lent et plus fragile (compilation à froid par route, risque de collision de port avec un `npm run dev` déjà ouvert dans un autre terminal).
  - Toujours vérifier qu'aucun autre serveur ne tourne déjà sur le port choisi avant de lancer — `reuseExistingServer: false` en local pour éviter de tester par erreur contre le serveur de dev de l'utilisateur.
  - Ce qui est testable sans compte : gardes d'authentification (chaque route protégée redirige bien vers `/login`), rendu des pages publiques, chemins d'erreur (identifiants invalides).
  - Ce qui exige un compte de test réel (parcours SUPER_ADMIN/Directeur authentifiés) : ne pas créer de compte soi-même (ça enverrait de vraies invitations) — demander à l'utilisateur des identifiants de test dédiés, sinon documenter clairement que ce parcours reste validé manuellement.
  - Assertions sur des textes d'erreur retournés par un service externe (Supabase Auth) : rester tolérant au contenu exact (le réseau peut renvoyer un message différent d'une tentative à l'autre) — vérifier le comportement observable (redirection, état du bouton) plutôt qu'une chaîne de caractères précise.

### Étape 6 — Livrables & mise à jour de la documentation

- Cocher dans ce fichier (`PLAN.md`) chaque livrable de la phase au fur et à mesure, pas en bloc à la fin.
- Marquer l'en-tête de la phase `✅ TERMINÉE (date)` seulement quand la DoD est réellement remplie (build vert, lint vert, tests E2E verts, parcours manuel validé) — pas quand le code est juste écrit.
- Si une décision durable pour les phases suivantes a émergé (convention de composant, piège d'infra, périmètre volontairement différé vers une autre phase) : l'enregistrer dans `CLAUDE.md`, pas seulement dans le message de conversation — sinon elle sera redécouverte à la dure la prochaine fois.
- Mettre à jour `list.md` si la phase couvre des éléments qui y sont listés.

### Étape 7 — Clôture

- Méthode confirmée : **une branche Git par phase**, mergée sur `main` une fois la DoD atteinte.
- `git add` ciblé (jamais `-A` aveugle), commit avec message décrivant la phase livrée, `push`.
- Merge sur `main` (demander confirmation avant tout `push --force` ou réécriture d'historique — jamais nécessaire dans ce flux).
- Créer la branche de la phase suivante (`phase-N-slug-descriptif`) et repartir à l'Étape 0 pour cette phase.

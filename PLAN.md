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

### Phase 8.5 — Refonte UX/UI, performance et corrections métier — ✅ TERMINÉE (2026-08-20)

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

**DoD** : build / lint / typecheck / unit / E2E verts ; aucun point de
`remarques_avant_phase9.txt` non traité ou non explicitement reporté.

#### Décisions prises pendant la phase

- **`activerAnneeScolaire` ne clôture plus l'année en cours.** Elle la basculait
  silencieusement en `TERMINEE` pour libérer l'index unique partiel. Figer notes,
  bulletins et facturation d'une année entière ne peut pas être un effet de bord :
  l'activation échoue désormais tant que l'année en cours n'est pas explicitement
  clôturée, et la clôture affiche puis journalise un bilan (notes en attente,
  factures non soldées, reste à recouvrer). Ce bilan est **informatif, pas
  bloquant** : clôturer avec des impayés est le cas courant, et c'est au Directeur
  de trancher.
- **Approbation des notes recentrée sur la Secrétaire seule** (doc 03). L'ouvrir
  aussi au Directeur diluait la responsabilité sans que personne ne traite la file.
- **Soumettre des notes ne crée aucune demande d'approbation** — comportement
  conforme au doc 07 § 14 : une note `SOUMISE` est immédiatement officielle, seule
  la *correction* d'une note soumise passe par la file. Le retour d'usage signalait
  l'inverse : c'était une attente, pas un défaut. L'écran d'approbation l'explique
  désormais explicitement plutôt que d'afficher un état vide muet.
- **Le nom d'une classe devient une composition** `Niveau + Série + Indice` au lieu
  d'une saisie libre, qui produisait « 6e A », « 6ème-A » et « 6EME A » pour la même
  classe, sans rattrapage possible ensuite dans les bulletins et les exports.
- **Séries du lycée** (migration `0010`) : le catalogue n'en portait que six. Faute
  de savoir laquelle manquait, l'ensemble standard du baccalauréat togolais a été
  ajouté — une série inutilisée ne coûte qu'une ligne de catalogue, une série
  absente bloque une création de classe. **À faire valider par l'établissement.**
- **Zones non modélisées du bulletin officiel** (absences, retards, punitions,
  exclusions, tableau d'honneur, félicitations, décision du conseil, observation du
  chef d'établissement) : rendues vides, comme sur le modèle papier où elles sont
  remplies à la main. Les renseigner dans l'application demanderait une table
  d'assiduité et une table de conseil de classe — **non fait, à arbitrer.**

#### Défauts corrigés que les suites automatisées ne voyaient pas

- `/etablissement/notes/resultats` ne s'affichait **jamais** : `getClassementClasse`
  bouclait `getMoyennesEleve` en série, puis la page relançait un `getMoyennesEleve`
  par élève, chacun rechargeant classe, programme, évaluations et un
  `getCoefficient` par matière. Remplacé par une lecture groupée en six requêtes
  (`services/resultats-classe.ts`), quelle que soit la taille de la classe.
- `getTenantContext` était réévalué à chaque `requireRole()`, soit un aller-retour
  réseau vers Supabase Auth par service touché. Mémoïsé par requête.
- **Coefficients** : changer de série laissait les valeurs de la série précédente
  affichées. `defaultValue` n'est lu qu'au montage et le composant restait monté —
  on saisissait donc les coefficients d'une série par-dessus ceux d'une autre.
- **Périmètre enseignant** : `getClassementClasse` ne vérifiait que le rôle. Un
  enseignant pouvait lire le classement de n'importe quelle classe en changeant
  l'identifiant dans l'URL. (Point qui était noté « à traiter en Phase 10 ».)
- **Boutons illisibles** : `text-white` était écrasé par la couleur héritée sur les
  boutons rendus via `asChild`, d'où un libellé noir sur fond bleu et sur fond rouge.
- **Aucune déconnexion** n'existait dans l'application.

#### Reporté explicitement

- Masquer les contrôles d'écriture en mode abonnement lecture seule n'est fait que
  sur les écrans finance.
- `DIRECTEUR` peut encore appeler `soumettreNotes` et `demanderModification` au
  niveau service ; seule la file d'approbation lui a été fermée.

---

### Phase 9 — Durcissement & mise en production — ✅ TERMINÉE (2026-08-20)

**Objectif** : passer d'un produit fonctionnel à un produit livrable.

**Livrables** :
- **Revue de sécurité** :
  - [x] Isolation tenant testée par tentative d'accès croisé entre écoles
        (`scripts/verifier-isolation.ts` : 9 tentatives, 0 fuite).
  - [x] Vérification des permissions par rôle (matrice complète) —
        `Docs/11-Matrice-permissions.md`, générée depuis le code et figée par un
        instantané versionné.
  - [ ] Step-up auth (PIN) testé sur toutes les actions d'approbation —
        couvert au niveau service, pas encore de bout en bout dans l'UI.
- [x] Couverture `AuditLog` complète sur les actions du doc 03 § 12
      (`audit-couverture.test.ts`).
- [ ] Tests E2E des parcours critiques — **permissions livrées** (3 rôles,
      suite complète à 57 tests verts) ; parcours en **écriture** non livrés,
      voir « Arbitrage en attente » ci-dessous.
- [ ] Sauvegardes (Supabase), journalisation, monitoring — procédure rédigée
      (`Docs/12-Exploitation.md`), **restauration non encore testée**.
- [x] **Procédure d'onboarding** : `Docs/13-Onboarding-etablissement.md` —
      rédigée, pas encore jouée sur une école réelle.
- [x] Bilan go/no-go : `Docs/14-Go-no-go.md`.

**DoD** : checklist de sécurité passée ; une école réelle configurée de bout en
bout depuis la checklist d'onboarding ; go/no-go documenté.

#### Défauts corrigés pendant la phase

Aucun n'était une fuite exploitable — la RLS tenait — mais tous reposaient sur
une policy sans filet applicatif, contre la règle de défense en profondeur :

- `getAbonnementCourant` acceptait un `etablissementId` arbitraire sans garde.
- `listPaiementsAbonnement` n'avait aucune garde.
- `listPlans` et les trois catalogues de `structure.ts` étaient lisibles sans
  session.
- `enregistrerDocument` et `marquerObsolete` n'exigeaient qu'une session.
- **La connexion n'était pas journalisée du tout**, ni par mot de passe ni par
  Google, alors que le doc 03 § 12 l'exige. Les échecs le sont aussi désormais :
  c'est leur répétition qui révèle une attaque.
- `createEtablissement`, qui ouvre un tenant, ne laissait aucune trace.
- `/sentry-example-page` était exposée en production.
- Une route refusée affichait « Application error: a client-side exception has
  occurred » — un écran blanc en anglais, indiscernable d'une panne. Remplacé
  par une frontière d'erreur qui distingue le refus d'accès de la panne
  (`src/app/error.tsx`).

#### Décisions prises pendant la phase

- **Tests de charge multi-école reportés** après la mise en production : le plan
  Supabase gratuit rend la mesure peu représentative et expose au dépassement de
  quota. Dette assumée, à reprendre sur un plan payant.
- **`journaliserConnexion` n'échoue jamais** et écrit via la clé service-role.
  À l'inverse d'`auditLog`, qui lève volontairement : perdre la trace d'un
  paiement doit annuler le paiement, mais un incident sur la table d'audit ne
  doit pas empêcher tout le monde de se connecter. Sur un échec de connexion, il
  n'y a de toute façon aucune session à laquelle rattacher l'écriture.
- **`/abonnement` reste ouverte à tous les rôles**, mais l'historique des
  règlements est réservé au Directeur. Fermer la page priverait un utilisateur
  bloqué de l'explication de son blocage.
- **La Secrétaire garde un accès finance en lecture seule** (doc 08 § 17) : ce
  n'est pas un trou, c'est documenté. Les tests E2E le vérifient comme tel.

#### Arbitrage en attente : E2E des parcours en écriture

L'invariant « pas de suppression physique » sur les paiements, notes et
inscriptions signifie qu'un E2E qui encaisse un paiement laisse une ligne
**définitive**, à chaque exécution. La base contient déjà 285 élèves et des
comptes réels. Trois voies, détaillées dans `Docs/14-Go-no-go.md` § 4 : école
jetable dédiée, écritures assumées dans l'école de démo, ou validation manuelle
consignée comme dette.

#### Harnais E2E : deux corrections de fond

- Le serveur de production met **106 à 208 s** à démarrer sur cette machine, ce
  qui faisait expirer Playwright avant qu'un test ne s'exécute. Délai relevé à
  300 s et réutilisation d'un serveur déjà lancé sur le port dédié 3100 — le
  `next dev` du développeur écoute sur 3000, la confusion que le réglage
  d'origine voulait éviter ne peut donc pas se produire.
- Chaque test se reconnectait dans son `beforeEach` : une vingtaine d'allers-retours
  vers Supabase Auth pour une suite qui n'en demande que quatre, et un test qui
  clignotait au gré de la charge. Session ouverte une fois par rôle
  (`e2e/auth.setup.ts`) et réutilisée via `storageState` : durée passée de 8,0
  à 2,6 minutes, et plus aucun test instable.

#### Outils livrés

```bash
npx tsx scripts/matrice-permissions.ts              # régénère Docs/11
npx tsx scripts/matrice-permissions.ts --verifier   # échoue si Docs/11 est périmé
npx tsx scripts/matrice-permissions.ts --instantane # régénère l'instantané des tests
npx tsx scripts/verifier-isolation.ts               # accès croisé entre deux écoles
npx tsx scripts/verifier-isolation.ts --purge       # supprime les écoles de test
```

Les E2E authentifiés lisent `.env.e2e` (ignoré par Git). Sans ce fichier, ils se
**sautent** au lieu d'échouer : le dépôt reste clonable et vert sans secrets.

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
| Mode hors-ligne différé | Pas de PowerSync ni de synchronisation hors-ligne au MVP. La PWA (manifeste, icônes, installation « Ajouter à l'écran d'accueil ») est reprise **après** la Phase 9 comme fonctionnalité indépendante (§ 8) — le service worker et le cache offline restent hors périmètre tant qu'ils ne sont pas explicitement demandés. |
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

---

## 8. Fonctionnalités (après la Phase 9)

> ⚠️ **Une fonctionnalité listée ici, même détaillée en checklist, n'est pas
> une autorisation d'implémenter.** Le développement d'une fonctionnalité ne
> démarre que sur demande explicite de l'utilisateur pour cette
> fonctionnalité précise — jamais parce qu'elle figure dans ce fichier.

Le socle MVP (Phases 0–9) est essentiellement bâti. Le travail à venir n'est
plus découpé en phases numérotées séquentielles mais suivi **fonctionnalité
par fonctionnalité**, indépendamment les unes des autres, documenté au fil de
l'eau ici et dans `CLAUDE.md`.

Gabarit de suivi par fonctionnalité : **Statut** (`Idée` → `Cadrée` → `En
cours` → `Terminée`), **Objectif**, **Livrables** en checklist (`- [ ]`),
**Dépendances / décisions à trancher avant de coder**, **DoD**. Les phases
0–9 ci-dessus restent l'historique du socle et ne sont pas rétroactivement
réécrites dans ce format.

---

### Fonctionnalité — Peaufinage responsive (mobile actuel + desktop)

**Statut** : Terminée (2026-08-22)

**Objectif** : durcir l'expérience responsive du site **actuel** (distinct de
la refonte mobile premium, en pause sur `feat/refonte-mobile`) — homogénéiser
toutes les listes sous `md`, alléger les en-têtes, et quelques réglages desktop.

**Livrables** :
- [x] **Motif de liste mobile généralisé** (`Docs/15-Motif-liste-mobile.md`) :
      barre d'outils (recherche + filtres repliés via `FiltresMobile` + action),
      `CarteListeMobile`, bouton flottant, barre d'onglets flottante. Appliqué à
      toutes les listes (élèves, matières, tarifs, rapports, résultats,
      bulletins…). `PageHeader` masqué en `hidden md:block`, `Card` sans bordure
      sur mobile (`max-md:border-0 max-md:bg-transparent max-md:shadow-none`).
- [x] **Action de création flottante** (`src/components/ui/declencheur-creation.tsx`,
      `DeclencheurCreation`) : bouton desktop + FAB mobile ancré au-dessus de la
      barre de navigation ; câblé dans `FormulaireModal`, `TarifForm`, `ClasseForm`.
- [x] **Titres de page responsives** : token `display-sm` passé en
      `clamp(1.25rem, 5vw, 1.5rem)` — un seul token adapte tous les titres au
      mobile sans surcharge par page. Remplace les usages de `text-headline-lg`
      (jamais défini dans l'échelle).
- [x] **Sidebar desktop repliable** : clic sur le logo ScolarGest (icône
      `GraduationCap` remplaçant le « S ») replie/déplie la sidebar en un rail
      d'icônes de 72px (`sidebar-rail`). État persisté en `localStorage`
      (`sidebar-collapse.tsx`, `ContenuDecale` décale le contenu),
      hydratation-safe.
- [x] **Profil enrichi** : `/profil` intègre les sections « Compte » (mot de
      passe, PIN si Directeur/Secrétaire) et « Session » (déconnexion) qui
      vivaient dans `/profil/parametres` — la page profil n'était qu'une carte
      d'identité. `/profil/parametres` reste comme point d'accès alternatif.

**Décisions** :
- La refonte mobile premium reste en pause (branche `feat/refonte-mobile`, plan
  local `Docs/16-Refonte-mobile-plan.md`) : ce lot peaufine l'existant, il ne le
  remplace pas.
- Génération de bulletins PDF durcie pour Vercel serverless (`@sparticuz/chromium`
  + `playwright-core`, `render.ts` défensif avec délais durs, `maxDuration=60`,
  `outputFileTracingIncludes`) — traité et confirmé résolu avec l'utilisateur.

---

### Fonctionnalité — PWA (Progressive Web App)

**Statut** : Terminée 2026-08-22 (base + service worker + invite d'installation)

**Objectif** : rendre ScolarGest installable sur mobile/desktop (« Ajouter à
l'écran d'accueil ») et poser l'identité applicative (favicon, icônes, manifeste).

**Livrables** :
- [x] **Manifeste** généré par Next (`src/app/manifest.ts` → `/manifest.webmanifest`) :
      `name`/`short_name` renseignés, `start_url: /dashboard`, `display: standalone`,
      `theme_color: #0052cc`, `background_color: #f8f9fb`, icônes 192/512 + variante
      `maskable`. Remplace `public/assets/icons/site.webmanifest` (statique, name
      vides, chemins d'icônes cassés).
- [x] **Favicon dans l'onglet + icônes applicatives** (`src/app/layout.tsx`,
      metadata `icons` + `appleWebApp` + `viewport.themeColor`) pointant vers
      `/assets/icons/` (favicon ico/16/32, apple-touch-icon 180).
- [x] **Middleware** : `/manifest.webmanifest` et les `.ico/.webmanifest` exclus de
      la redirection d'authentification (sinon servis en `/login` pour un visiteur
      non connecté).
- [x] **Service worker** (`public/sw.js`, enregistré par `PwaInstaller`) avec
      handler `fetch` — condition d'installabilité de Chrome. Précache la coquille
      statique (manifeste + icônes), cache-first sur `/_next/static` et `/assets/`,
      réseau-d'abord sur les navigations. **Volontairement pas** de cache des pages
      authentifiées ni des données (Supabase/RLS) : `CACHE_VERSION` purgé à
      l'activation. `/sw.js` ajouté à l'exclusion du `matcher` middleware.
- [x] **Invite d'installation maison** (`src/components/pwa/pwa-installer.tsx`) :
      capte `beforeinstallprompt` (les navigateurs n'ouvrent plus d'invite
      automatique), affiche une bannière « Installer ScolarGest », mémorise le refus
      en `localStorage`, se masque sur `appinstalled` / mode standalone. iOS n'émet
      pas l'événement (installation manuelle) : rien affiché là-bas.
- [ ] Screenshots de manifeste (`images/screenshots/`) pour l'invite d'installation
      enrichie — quand de vrais écrans produit seront disponibles.

**DoD** : installable avec une icône et un nom corrects ; le service worker sert la
coquille statique hors-ligne sans casser les Server Actions ni l'auth. Vérifié :
`navigator.serviceWorker.controller` actif, scope racine, aucune erreur console.

#### Incrément 2 — résilience réseau (✅ mergé sur `main` le 2026-08-28, `feat/pwa`)

L'installabilité ne rendait rien utilisable hors ligne. Cet incrément cible le
flux le plus exposé sur le terrain : la saisie de notes, tenue entièrement en
mémoire React — une coupure ou un rechargement faisait perdre le travail non
enregistré, et un échec réseau sur une ligne stoppait la boucle sans rien
mettre en attente.

- [x] **Page `/offline` réelle** (branded), précachée et servie par le service
      worker quand une navigation échoue et qu'aucune version en cache n'existe.
      Remplace le repli sur `manifest.webmanifest`, qui affichait du JSON brut à
      l'utilisateur. `CACHE_VERSION` → `scolargest-v3`.
- [x] **Contexte de connectivité global** (`src/components/connectivity/`) +
      bannière « Hors ligne » persistante, montés à la racine — donc visibles
      aussi sur `/login` et la landing, qui ne passent pas par `AppLayout`.
- [x] **Brouillons de saisie persistés en IndexedDB** (`idb`,
      `src/lib/offline/notes-brouillon-db.ts`) : la ligne `dirty` **est** la file
      d'attente, pas de structure parallèle. Restauration au montage, écriture
      débattue ~500 ms à chaque frappe, retry automatique au retour du réseau
      (événementiel, pas de polling) et bouton « Réessayer » manuel.
      `saisirNoteAction` étant un upsert sur `(evaluationId, eleveId)`, un retry
      est idempotent — aucune déduplication côté client.
- [x] **Nettoyage à la déconnexion** (`DeconnexionButton`) : IndexedDB n'est pas
      accessible depuis une Server Action, d'où un wrapper client. Évite qu'un
      brouillon soit restauré sous un autre compte sur un poste partagé.
- [x] Raccourci clavier `Ctrl + .` pour replier/déplier la sidebar desktop.

**Hors périmètre assumé** : cache de lecture hors-ligne (dashboard, élèves,
finances), moteur de synchronisation générique, Background Sync API, mise en
file de `soumettreNotesAction` et des demandes de correction — ces deux
dernières sont des transitions d'état à enjeu fort, gardées synchrones.

**DoD** : typecheck, lint, 183 tests et build verts ; `/offline` prérendue en
statique.

---

### Fonctionnalité — Chatbot de configuration à la demande de démo

**Statut** : Idée (non cadrée)

> **À ne pas confondre** avec « Onboarding conversationnel » plus bas. Celle-ci
> est **avant-vente** : un prospect anonyme remplit `demande_demo`, aucun
> établissement n'existe encore. L'autre est **post-inscription** : le Directeur
> d'un établissement déjà créé configure sa structure via `/demarrage`.

**Objectif** : remplacer/compléter le formulaire statique de demande de
démo (`src/app/demande-demo-actions.ts`, table `demande_demo`) par un
dialogue qui récolte des informations de configuration structurées, au-delà
des champs actuels (nomEtablissement, nomContact, email, telephone, ville,
message).

**Livrables** :
- [ ] Cadrage produit : liste précise des champs à récolter en plus de
      l'existant — ex. cycles enseignés, effectif élève approximatif,
      nombre de classes envisagé.
- [ ] Décision tranchée : la conversation remplace le formulaire actuel, ou
      vient en complément (bouton « discuter avec l'assistant »).
- [ ] Décision technique tranchée : moteur conversationnel — LLM avec
      extraction structurée (function calling) vs. arbre de questions
      scripté (plus simple, sans dépendance API tierce, plus prévisible).
- [ ] Migration numérotée (`supabase/migrations/00XX_...sql`) : extension de
      `demande_demo` avec les champs structurés (ex. `cyclesEnseignes
      text[]`, `effectifEstime int`, `nombreClassesEstime int`) ou table
      séparée `demande_demo_config` liée par `demandeId` si le volume de
      champs le justifie.
- [ ] Route publique (ex. `/demo/assistant`) : composant client de chat.
- [ ] Server Action de persistance : écrit l'échange et l'état structuré
      final dans `demande_demo` (même table que le formulaire actuel, un
      seul point de traitement SUPER_ADMIN, conformément à `analysis.md`
      Q5 — pas de self-service, traitement toujours manuel).
- [ ] Écran SUPER_ADMIN (liste des demandes) : affichage des nouveaux champs
      structurés en plus du message libre actuel.
- [ ] Si arbre de questions scripté retenu : modélisé comme une machine à
      états pure, testée unitairement avant toute UI (même discipline que
      `calcul-moyennes.ts`, principe #7).

**Dépendances / décisions à trancher avant cadrage définitif** :
- [ ] Si LLM tiers retenu : coût par conversation, latence, confidentialité
      des données envoyées à un tiers — décision produit.
- [ ] Vérifié que le chatbot réutilise la politique RLS existante de
      `demande_demo` (insertion déjà ouverte à `anon, authenticated`,
      `0002_demande_demo.sql`) sans en créer une plus permissive.

**DoD** (à date de cadrage, pas de code encore écrit) : cadrage produit
validé par l'utilisateur, décision moteur conversationnel actée, schéma de
données revu — *avant* toute ligne de code.

---

### Fonctionnalité — Réseau social interne (fondation du portail parent)

**Statut** : Idée (non cadrée, bloquée par une décision d'authentification
non encore posée)

**Objectif** : poser une brique de communication interne (fil de
publications, commentaires) consultable par les responsables légaux, comme
fondation du futur portail parent — inexistant dans toute phase livrée à ce
jour.

**Constat bloquant** : la table `responsable` (`0001_init.sql`) n'a aucun
lien vers `auth.users`, contrairement à `Utilisateur` qui EST
`auth.users.id`. Un responsable légal ne peut pas se connecter à la
plateforme aujourd'hui. Cette décision n'est couverte par aucune des Q0–Q17
déjà tranchées dans `analysis.md` : une nouvelle question devra y être
ajoutée avant tout cadrage définitif.

**Livrables** :
- [ ] Cadrage produit : qui publie (établissement ? enseignant ? classe ?),
      qui lit (responsables de quels élèves), commentaires/réactions,
      modération, notifications.
- [ ] Nouvelle question ajoutée à `analysis.md` et tranchée : mode
      d'authentification du responsable (compte Supabase Auth propre, lien
      magique par email, OTP téléphone — l'email n'est pas systématique
      dans le contexte togolais).
- [ ] Décision tranchée et documentée dans `CLAUDE.md` : statut applicatif
      du responsable connecté — sixième rôle (extension explicite du
      principe « 5 rôles fixes »), ou espace entièrement séparé avec sa
      propre authentification et son propre layout.
- [ ] Migration numérotée : entités `publication` (auteur,
      `etablissementId`, `classeId` optionnelle, contenu, date) et
      `publication_commentaire`, visibilité dérivée de la table de liaison
      `eleve_responsable` déjà existante (`lienParente`, `principal`).
- [ ] Vérifié : `etablissementId` sur chaque nouvelle table (isolation
      tenant), RLS + garde applicative explicite, `AuditLog` sur les
      publications si jugées sensibles (principes #3 et #5).
- [ ] UI : flux de lecture minimal pour les responsables, dans l'espace
      tranché ci-dessus.

**Dépendances / décisions à trancher avant cadrage définitif** :
- [ ] Authentification responsable (bloquant, voir constat ci-dessus).
- [ ] Extension du principe « 5 rôles fixes » documentée dans `CLAUDE.md` le
      jour où elle est actée, pas avant.

**DoD** (à date de cadrage, pas de code encore écrit) : question
d'authentification tranchée et ajoutée à `analysis.md`, statut du rôle
responsable acté, périmètre du fil de publications validé par
l'utilisateur — *avant* toute ligne de code.

---

### Fonctionnalité — Peaufinage UI mobile (corrections visuelles)

**Statut** : En cours (branche `feat/mobile-ui-redesign`, 2026-08-23)

**Objectif** : corriger les défauts visuels et d'ergonomie identifiés lors
d'une analyse de la version mobile déployée — sans refonte majeure (la refonte
premium reste en pause sur `feat/refonte-mobile`).

**Livrables** :
- [x] Badge « Ctrl K » masqué sous `md` (`hidden md:inline-flex` dans
      `RechercheGlobale.tsx`) — sans objet sur mobile sans clavier physique.
- [x] `formatDate` défensive dans `EvaluationsList.tsx` : date null/invalide
      affiche « — » au lieu de « Invalid Date ».
- [x] `StatCard` : layout dual — ligne horizontale compacte (icône + label +
      valeur) sur mobile, carte verticale `h-32` inchangée sur desktop.
- [x] Dashboard : grilles `stat-cards` en `grid-cols-2` sur mobile pour tous
      les rôles (Directeur, Comptable, Secrétaire, Enseignant).
- [x] `Dialog` : hook `useKeyboardOffset` (Visual Viewport API) qui décale la
      bottom sheet vers le haut quand le clavier virtuel s'ouvre ; `max-h`
      passe de `85vh` à `85dvh` (viewport dynamique).
- [x] `CoefficientsForm` : layout dual — liste compacte sur mobile (nom +
      type + champ `w-16`, `inputMode="numeric"`) ; tableau desktop inchangé.
- [x] Facture détail (`/etablissement/finances/factures/[id]`) : le tableau
      « Versements » n'avait jamais reçu la bascule `CarteListeMobile` déjà
      appliquée à `/etablissement/finances/paiements` — corrigé, même motif.
- [x] `LignesFactureEditor` et la grille de saisie de notes (éditable et
      verrouillée) : cartes empilées sous `md` au lieu d'un tableau à
      colonnes fixes qui débordait largement un écran de téléphone.
- [x] Écran de chargement stylisé (`BrandedLoader`) sur les 50 frontières
      `loading.tsx` de l'app (racine, dashboard, chaque page de l'espace
      établissement, profil, rapports, super-admin, utilisateurs) — le
      squelette de tableau générique (`PageSkeleton`) restait le premier
      retour visuel sur quasiment chaque navigation.
- [ ] Vérification des pages de liste qui n'utilisent pas encore `FiltresMobile`
      / `BarreOutilsListe` (enseignants, classes, tarifs…).
- [ ] Pages d'indirection (Notes → 2 blocs, Finances → 5 blocs) à raccourcir
      sur mobile.

**DoD** : retours visuels de l'utilisateur réglés ; desktop inchangé ;
typecheck et lint verts à chaque commit ; mergé sur `main`.

---

### Fonctionnalité — Corrections fonctionnelles rôles & permissions

**Statut** : ✅ Terminée et mergée sur `main` (2026-08-25, branche
`feat/corrections-fonctionnelles`)

**Objectif** : traiter les défauts fonctionnels liés aux rôles, aux permissions
et aux flux métier qui ont été identifiés lors des tests et de l'usage réel,
maintenant que le socle visuel mobile est stabilisé.

**Livrables** :
- [x] **Versements** : aucun bouton n'existait pour que la Secrétaire ou le
      Comptable enregistrent un versement. Corrigé — `SECRETAIRE` avait en
      réalité perdu l'accès à l'onglet Finances dans la navigation.
- [x] **Droits finance de la Secrétaire** alignés sur ceux du Comptable
      (frais, tarifs, factures, versements, import paiements) : contexte
      togolais où de nombreux établissements n'ont pas de Comptable dédié
      (`Docs/03 §SECRETAIRE`).
- [x] **Plusieurs Directeurs par établissement** : formulaire d'invitation
      ajouté sur `/super-admin/etablissements/[id]` — le service et la règle
      métier existaient déjà (`Docs/03 §Directeur initial`), seule l'UI
      manquait.
- [x] **Refonte du workflow de validation des notes** (le vrai correctif
      derrière « la Secrétaire ne reçoit rien ») : `SOUMISE` comptait
      directement dans les moyennes sans jamais passer par une validation, et
      aucune UI ne permettait à un enseignant de demander une correction —
      la file d'approbation restait vide en permanence. Deux files
      distinctes maintenant : soumission d'évaluation (bloc entier, PIN) et
      demande de correction sur note `VALIDE` (par note, PIN). Migration
      `0011_validation_soumission_notes.sql` ; détail complet dans
      `Docs/03 §11` et `Docs/07`.
- [x] Cloche de notifications (point rouge) signalant les soumissions et
      corrections en attente à la Secrétaire.
- [x] Bug de compilation corrigé (déclaration dupliquée) qui bloquait
      silencieusement toute la saisie de notes.
- [x] Service worker désactivé en développement (et désinscrit les sessions
      antérieures) : en dev les chunks Next ne sont pas hashés par contenu,
      un cache-first le figeait sur d'anciens correctifs indéfiniment — c'est
      ce qui a fait perdurer le bug « Soumettre » bien après son correctif
      côté serveur.
- [x] `window.confirm()` remplacé par une modale in-app pour la soumission
      des notes (peu fiable en contexte PWA installée).
- [x] Comportement de suspension d'abonnement clarifié et documenté
      (`Docs/08 §20`, `analysis.md` Q15) — confirmé volontairement plus
      strict que l'expiration, pas un bug.

**Dépendances** : Phase 9 terminée, matrice de permissions à jour.

**DoD** : typecheck, lint et suite de tests (183) verts à chaque commit ;
migration appliquée en production via `db push` ; mergé sur `main`.

---

### Fonctionnalité — Onboarding conversationnel (`/demarrage`)

**Statut** : ✅ Terminée et mergée sur `main` (2026-08-29, branche
`feat/onboarding`)

**Objectif** : un établissement fraîchement créé par le SUPER_ADMIN est une
coquille vide. Le Directeur devait découvrir seul huit écrans, dans un ordre
imposé par des dépendances invisibles (pas de classe sans niveau, pas de
coefficient sans programme, pas d'enseignant sans année scolaire pour la
séquence de matricule). Rien ne le lui disait.

**Décisions structurantes** :
- **Aucun LLM.** Les catalogues système étant finis et fermés (4 cycles,
  16 niveaux déjà chaînés, 6 séries), l'essentiel de la configuration est une
  *sélection dans des listes connues*. Un modèle ajouterait latence, dépendance
  réseau et risque de proposer un niveau hors catalogue, sans rien apporter.
  Les étapes sont déclarées dans `src/lib/onboarding/etapes.ts`.
- **Écriture au fil de l'eau**, étape par étape, via les services existants —
  donc leurs gardes `requireRole`, `exigerPin` et `auditLog`. Les étapes
  dépendent des identifiants réels des précédentes, et `activerCycle` est
  irréversible : différer les écritures donnerait une fausse réversibilité.
  Le PIN est saisi **une fois par étape** et réutilisé pour le lot.
- **Progression déduite des données** (année ACTIVE ? cycles actifs ?
  classes ?) plutôt que stockée — la dupliquer la ferait diverger dès qu'une
  configuration passe par les écrans habituels. La table
  `onboarding_progression` (`0012`) ne porte que l'indéductible : étapes
  volontairement sautées, bannière masquée, et **par sa seule existence** le
  fait d'avoir déjà été redirigé une fois. C'est ce dernier point qui rend la
  redirection interruptible plutôt que forcée.
- **Onboarding par rôle.** `createTypeFrais` et `createTarif` exigent COMPTABLE
  ou SECRETAIRE (`Docs/08 §17` donne le Directeur en lecture seule sur la
  finance). Plutôt que d'élargir ces gardes, le Directeur configure la
  structure et invite la Secrétaire, qui reçoit **son propre parcours** finance
  à sa première connexion.

**Livrables** :
- [x] Migration `0012_onboarding_progression.sql` (RLS tenant, appliquée en
      production).
- [x] Service `src/services/onboarding.ts` — 6 fonctions gardées, ajoutées à
      l'instantané de la matrice. Les rôles y sont listés
      littéralement : un `requireRole(...SPREAD)` faisait tomber la matrice sur
      `DYNAMIQUE`, qui ne dit plus quels rôles sont admis.
- [x] Parcours Directeur en 9 étapes : code de confirmation → année scolaire →
      cycles → classes → matières → programme → coefficients → enseignants
      *(facultative)* → équipe administrative *(facultative)*.
- [x] Parcours Secrétaire/Comptable en 2 étapes : types de frais → tarifs.
      Saisie **par niveau**, développée sur les classes (20 classes × 4 types
      feraient 80 champs).
- [x] **Carte flottante à deux colonnes** (`FilDemarrage.tsx`, `RailEtapes.tsx`)
      — une seule étape à la fois, rail de progression à gauche avec le résumé
      de chaque étape franchie. Remplace le fil conversationnel initial, qui
      empilait toutes les étapes et s'allongeait sans fin.
      Le bouton « Retour » des maquettes de référence n'est **pas** repris :
      chaque étape écrit en base au moment où elle est validée et l'activation
      d'un cycle est définitive — il mentirait sur ce qu'il fait. Le rail
      montre ce qui a été fait ; on consulte, on ne défait pas.
      Le rail est masqué sous `md` : sur un téléphone il repousserait l'étape
      en cours hors du premier écran, la barre de progression prenant le relais.
- [x] **Écran de félicitations** (`EcranFinal.tsx`) avec le bilan chiffré
      (`getBilanOnboarding`) : cycles, classes, matières, coefficients,
      enseignants, élèves, frais, tarifs. Compté en base à la demande et non
      cumulé au fil des étapes — la configuration peut aussi passer par les
      écrans habituels, un compteur maintenu à part afficherait moins que la
      réalité. Les compteurs à zéro sont masqués : « 0 enseignant » à qui vient
      de passer l'étape volontairement ressemble à un reproche.
- [x] `Bulles.tsx` réduit aux deux briques encore partagées par les étapes
      (`PuceChoix`, `ErreurEtape`).
- [x] Redirection unique depuis `/dashboard` + bannière de rappel ensuite.
      Le contrôle vit dans la page et non dans `src/middleware.ts`, qui
      s'exécute à chaque requête et paierait un aller-retour de base par
      navigation pour un besoin limité à l'arrivée après connexion.
- [x] `scripts/seed-onboarding-test.ts` — établissement de test vide,
      Directeur, Secrétaire, 50 élèves, `--reset` / `--purge`.

**Correctifs issus du test de bout en bout** (le parcours a été déroulé
entièrement dans le navigateur, pour les deux rôles — ces défauts
n'apparaissaient qu'à l'exécution réelle) :
- [x] **Robustesse des appels d'action** (`appel-action.ts`, 14 appels) :
      chaque étape supposait qu'une Server Action aboutit toujours. Une
      coupure réseau ou un redémarrage serveur résout l'appel sur `undefined`,
      et l'utilisateur recevait une erreur d'exécution brute. Sur une
      application visant des connexions instables, c'est un cas normal.
- [x] **Messages d'erreur muets** : les services propagent les erreurs
      Supabase telles quelles, or ce sont des objets simples —
      `e instanceof Error` était toujours faux. Le même défaut cassait la
      détection des doublons, qui faisait échouer le lot entier au lieu de
      compter la ligne comme existante.
- [x] **Étape Année non idempotente** : deux écritures (créer puis activer) ;
      une interruption entre les deux laissait une année en `PREPARATION` que
      toute nouvelle tentative heurtait sur l'unicité — parcours bloqué sans
      issue depuis l'interface.
- [x] **Champs PIN pris pour des mots de passe** : le gestionnaire du
      navigateur y injectait le mot de passe du compte, tronqué silencieusement
      par le filtre chiffres ; il visait aussi la recherche globale comme champ
      identifiant. Un seul champ visible, `autoComplete="off"` sur la recherche.
- [x] **Ordre du cursus** : `niveau.ordre` repart à 1 dans chaque cycle, d'où
      un entrelacement (6ème, 2nde, 5ème, 1ère). Tri sur
      `(cycle.ordre, niveau.ordre)`, appliqué aussi aux tarifs.
- [x] **Séries au lycée** : `programme_etablissement` est unique sur
      `(etablissement, niveau, matiere)` **sans série** — le schéma ne permet
      pas un programme par série. La différenciation passe par
      `coefficient_matiere.serieId`, un coefficient absent valant 0 dans le
      calcul des bulletins. Les coefficients ne proposent donc que les séries
      ayant une classe ouverte, et 0 est admis pour exclure une matière.

**Points ouverts** :
- [ ] Un établissement **sans abonnement** passe en lecture seule
      (`evaluerAcces` → `AUCUN`) et **toutes les écritures renvoient 403** :
      si un SUPER_ADMIN oublie l'abonnement, le Directeur affronte un
      questionnaire dont chaque étape échoue sans explication. Comportement
      intentionnel, message dédié à ajouter.
- [ ] Programme **distinct par série** (et pas seulement coefficients
      différenciés) : migration touchant `programme_etablissement`, les
      bulletins et les résultats — à évaluer si le besoin se confirme.
- [ ] Onboarding pédagogique des écrans **opérationnels** (saisie de notes,
      encaissement, bulletins), impossible pendant la configuration puisqu'il
      n'y a pas encore de données à manipuler.

**DoD** : typecheck, lint, 183 tests et build verts ; migration appliquée ;
parcours vérifié de bout en bout dans le navigateur pour les deux rôles.

---

### Fonctionnalité — Identité visuelle des documents & corrections du bulletin

**Statut** : ✅ Terminée et mergée sur `main` (2026-08-30, branche
`feat/identite-documents`). Migration `0013` appliquée.

**Objectif** : permettre à chaque établissement de marquer ses documents
(logo, filigrane), et corriger deux défauts du bulletin secondaire relevés
en confrontant le rendu au modèle papier réel d'un établissement.

**Corrections du gabarit** (aucun service ni moteur de calcul touché) :
- [x] **Note définitive** : la colonne affichait `moyenneFinale`, donc la
      même valeur que « Moy. Géné sur 20 » deux colonnes plus tôt — le
      coefficient n'était jamais appliqué. Elle vaut désormais
      `moyenne × coefficient`, et reste vide faute de moyenne plutôt que
      d'afficher un `0` trompeur. Le total des points en pied de tableau
      utilisait déjà la bonne formule sans que la ligne s'en serve.
- [x] **Lignes vides** : le tableau était complété jusqu'à vingt lignes
      anonymes. Il liste maintenant exactement les matières du programme du
      niveau — une matière enseignée mais non notée garde son nom avec des
      cellules vides, comme sur le modèle papier (Allemand, Ewe, Musique…).
      Le nombre de lignes suit donc le programme réel, sans constante à
      régler.

**Identité visuelle** :
- [x] Migration `0013_parametres_document.sql` : table par établissement
      (filigrane en **texte libre**, activation, chemin du logo). Table
      dédiée plutôt que des colonnes sur `etablissement`, qui n'est écrite
      que par le SUPER_ADMIN (`createEtablissement` est gardée par
      `requireRole()` sans argument, et aucun `updateEtablissement`
      n'existe) : le réglage relève du Directeur, pas de la plateforme.
- [x] **Logo intégré en data URI** au moment du rendu : le bucket
      `documents` est privé et Chromium n'aurait aucune session pour aller
      chercher le fichier. Le bucket reste fermé, aucune URL publique.
- [x] **Filigrane en `position: fixed`** — c'est ce qui le fait répéter sur
      chaque page du PDF ; en `absolute` il n'apparaîtrait que sur la
      première. `print-color-adjust: exact` empêche Chromium d'effacer une
      teinte très claire à l'impression.
- [x] Module partagé `src/lib/pdf/templates/identite.ts` pour les trois
      gabarits (bulletin générique, bulletin secondaire, reçu) — un
      filigrane qui diffèrerait d'un document à l'autre trahirait l'objectif.
- [x] Écran **Établissement → Identité des documents** (Directeur seul).
- [x] **Invite proposée une seule fois** avant la première génération de
      bulletin. « Ne plus proposer » crée la ligne, dont l'existence vaut
      « déjà proposé » (même motif que `onboarding_progression`) ; le
      réglage reste modifiable dans les paramètres — une question posée une
      fois ne doit pas devenir une décision verrouillée à vie.

**Correctif de sécurité** : `chargerLogoDataUri` recevait un **chemin
arbitraire** et lisait le bucket avec la clé service-role, qui contourne la
RLS, sans aucune garde — un chemin forgé aurait permis de lire le logo d'un
autre établissement. Attrapé par le test « aucune fonction de service ne
touche la base sans garde ». Garde de rôle ajoutée, plus vérification que le
chemin est bien préfixé par l'établissement appelant.

**Décisions actées** :
- Le filigrane sert **l'identité visuelle**, pas l'authentification : il se
  copie trivialement. Pour lutter contre la falsification, la piste retenue
  serait un QR code adossé à `generateNumeroDocument`, non implémentée.
- L'historisation n'est pas gérée : régénérer un bulletin après avoir changé
  le filigrane produit un PDF différent de l'archive. Assumé — les PDF déjà
  produits restent figés dans Storage, et le produit n'est pas commercialisé.
- `etablissement.logo` (colonne présente depuis `0001`, jamais utilisée) est
  **laissée en l'état**, non reprise, pour ne pas préempter un usage
  SUPER_ADMIN.

**DoD** : typecheck, lint, 186 tests et build verts ; migration appliquée et
vérifiée en base (colonnes présentes, RLS active, insertion anonyme refusée
en `42501`).

---

### Fonctionnalité — Recentrage produit sur le secondaire

**Statut** : ✅ Terminée (2026-08-31) — branche `feat/secondaire-uniquement`.

**Objectif** : ScolarGest ne s'adresse plus qu'au collège et au lycée. La
maternelle et le primaire sortent du catalogue produit.

**Décision structurante — retrait du catalogue, pas suppression des données.**
L'audit de la base a montré que le primaire était habité : 5 classes, ~98
inscriptions, ~8 000 notes chez « Les Victorieux ». Trois raisons de ne rien
supprimer, même en l'absence de client réel :

1. Les notes et les inscriptions sont sous l'invariant « pas de suppression
   dure ».
2. `cycle` et `niveau` sont référencés par `cycle_etablissement`, `classe` et
   `programme_etablissement` — un `delete` se heurterait aux clés étrangères,
   ou pire, cascaderait.
3. La décision reste réversible : repasser `disponible` à `true` rouvre un
   cycle sans rien reconstruire.

Cela sépare proprement deux questions de calendriers différents : *plus
personne ne peut choisir le primaire* (immédiat) et *que deviennent les
données existantes* (jamais tranché, et sans urgence tant qu'aucun client
réel n'est concerné).

**Livrables** :

- [x] Migration `0014_cycles_secondaire_uniquement.sql` : colonne
      `cycle.disponible`, passée à `false` pour MATERNELLE et PRIMAIRE.
- [x] Coupure de `niveauSuivantId` sur les cycles retirés — **la 6ème devient
      le niveau d'entrée**. `CM2 → 6ème` ferait remonter un élève depuis un
      cursus que le produit ne couvre plus.
- [x] `listCycles()` filtre sur `disponible` ; `/etablissement/cycles` et
      l'étape 2 de `/demarrage` s'alignent sans modification propre.
- [x] `activerCycle()` refuse un cycle retiré **à l'écriture**. Le `cycleId`
      vient de l'appelant : le masquer dans une liste n'empêche pas un appel
      forgé de l'activer.
- [x] `listCyclesActifs()` **non filtrée**, délibérément — un établissement
      déjà en primaire garde ses classes, ses notes et ses bulletins.
- [x] `NomCycle` réduit à `'COLLEGE' | 'LYCEE'` ; suggestions de matières
      maternelle et primaire retirées ; libellés de `EtapeCycles` alignés.
- [x] `seed-demo.ts` recentré : plus d'activation du primaire, programme,
      tarifs et âges de référence alignés. Une classe de 4ème comble le trou
      que le cursus collège avait dans le jeu de démonstration.
- [x] Documentation : sections « Modifications » faisant autorité dans
      `Docs/01-Vision`, `Docs/04` et `Docs/07`, plus `Docs/13`, `list.md` et
      `CLAUDE.md`.

**Ce qu'il ne faut pas « nettoyer » ensuite** : le gabarit générique
`src/lib/pdf/templates/bulletin.ts` a l'air mort, puisque le dispatch de
`bulletin.ts:94` envoie collège et lycée vers le gabarit secondaire. Il ne
l'est pas : une classe de primaire existante l'atteint toujours. De même,
`0003_seed_catalogues.sql` et `supabase/seed.sql` continuent d'insérer les
quatre cycles — c'est `0014` qui restreint ensuite, aucun des deux n'est
l'état final.

**Dette laissée ouverte** : le sort des données primaire résiduelles n'est pas
tranché. Aucune urgence — zéro client réel en base au moment de la décision.

**DoD** : catalogue vérifié en base (deux cycles disponibles, chaînage partant
de la 6ème, 28 classes toujours lisibles), lint, tests et build verts.

---

### Fonctionnalité — Modèle économique : essai, tarifs et paiement FedaPay

**Statut** : ✅ terminée et mergée sur `main` (2026-08-31) — branche
`feat/pricing`. Migrations `0015` à `0017`.

**Objectif** : un vrai paywall SaaS, avec paiement intégré, pour rendre
l'acquisition autonome. Prestataire : **FedaPay** (Mobile Money, XOF).

**Décisions de cadrage** :

- **Facturer le cycle, pas le tenant.** Un complexe collège-lycée est bien
  deux unités facturables, mais **un seul espace de données**. Les séparer en
  deux tenants casserait le passage de cohorte 3ème → 2nde (`fn_passer_cohorte`
  est scopée sur un `etablissementId`), scinderait l'historique de l'élève,
  dupliquerait les enseignants partagés et imposerait deux comptes au
  Directeur. `cycle_etablissement` modélise déjà la quantité à facturer.
- **10 000 F/mois et 100 000 F/an par cycle**, soit 20 000 et 200 000 pour un
  complexe. Le palier « au-delà de 500 élèves » est **abandonné pour le
  moment** : le seuil demandait des données de consommation qu'on n'a pas, et
  une falaise tarifaire pousse une école à ne pas saisir ses élèves — dans un
  logiciel de gestion scolaire, la donnée est le produit.
- **Essai gratuit de 30 jours, accès complet**, décompté depuis la définition
  du PIN de démarrage.

**Livrables** :

- [x] Migration `0015` : `essaiDebuteLe`/`essaiFinLe` sur `etablissement`,
      `nombreCycles`/`montantTotal` sur l'abonnement, catalogue tarifaire.
- [x] Trigger `fn_proteger_dates_essai` — la policy `etablissement_tenant` est
      `for all`, un Directeur pouvait donc **prolonger son propre essai**. Le
      trigger réécrit les dates au démarrage et refuse toute modification
      ultérieure. Migration `0016` : reconnaître aussi la clé service-role,
      sans quoi les outils de la plateforme étaient bloqués eux aussi.
- [x] Niveau d'accès `ESSAI` dans `evaluerAcces`, qui prend désormais un objet
      `EtatFacturation`. Ordre : SUSPENDU, puis abonnement payé, puis essai.
- [x] Section de tarifs publique (`SectionTarifs.tsx`) et entrée « Tarifs »
      dans la navbar d'accueil.
- [x] Intégration FedaPay : `src/lib/fedapay/client.ts` (SDK officiel),
      `src/services/paiement-fedapay.ts`, route `POST /api/fedapay/webhook`,
      migration `0017` (`transaction_fedapay`).
- [x] Page de paiement `/abonnement/souscrire` : choix de formule, Mobile Money
      direct ou page hébergée en repli, page de retour `/abonnement/retour`.
- [x] Saisie du numéro en **pays + numéro** (`src/lib/fedapay/pays.ts`), avec
      normalisation testée et opérateurs filtrés par pays.
- [x] Bascule sur le domaine `scolargest.com`, avec repli sur `VERCEL_URL`
      (`src/lib/url-app.ts`).
- [ ] Relances avant échéance (courriel).
- [ ] Console SUPER_ADMIN : suivi des transactions FedaPay.
- [ ] **Paiement réel bloqué côté FedaPay — compte non autorisé.** Diagnostic
      affiné le 2026-08-31 après la bascule de domaine :

      | mode | numéro | montant | résultat |
      |---|---|---|---|
      | `momo_test` | 64000001 | 100 000 | `declined` |
      | `momo_test` | 66000001 | 100 000 | `declined` |
      | `momo_test` | 64000001 | 1 000 | `declined` |
      | `moov_tg` | 90000001 | 100 000 | **400 « Opération non autorisée »** |

      La dernière ligne est la plus parlante : ce n'est pas un rejet de
      paiement mais un **refus de permission**. Le compte n'a pas le droit
      d'utiliser ce moyen de paiement — cohérent avec un compte non validé
      (NIF et CCRM manquants). Le `declined` de `momo_test` est
      vraisemblablement le même verrou, exprimé plus poliment : le montant et
      le numéro n'y changent rien.

      **Ce n'est pas un problème de code, et le domaine n'y était pour rien** :
      le refus arrive dans la réponse immédiate de `sendNowWithToken`, avant
      qu'aucun webhook n'entre en jeu.

      Tout le reste du chemin est prouvé : transaction créée, jeton généré,
      `sendNowWithToken` accepté avec l'enveloppe `phone_number`,
      `payment_intent` créé en `mode: momo_test`, webhook répondant en
      production sur l'apex, ouverture d'abonnement et idempotence vérifiées
      avec une vraie signature.

      À vérifier côté tableau de bord FedaPay : les moyens de paiement activés
      sur le compte, et les réglages du bac à sable (la documentation mentionne
      que l'échec se simule « selon les réglages de l'environnement sandbox »).
      Au passage en live : remplacer les clés dans Vercel, passer
      `FEDAPAY_ENVIRONMENT` à `live`, déclarer le webhook sur
      `https://scolargest.com/api/fedapay/webhook`. Aucun code à modifier.

**Ce que la documentation FedaPay impose** :

- Le **webhook est la source de vérité**, pas la redirection de retour : une
  école dont le téléphone s'éteint après confirmation doit être activée quand
  même.
- La signature `X-FEDAPAY-SIGNATURE` se vérifie sur le **corps brut** —
  `request.text()` avant tout parsing.
- **Le webhook doit être exclu du `matcher` de `src/middleware.ts`**, qui
  redirige vers `/login` tout ce qui n'y est pas nié. FedaPay recevrait un 307,
  considérerait la livraison réussie, et l'abonnement ne serait jamais activé —
  sans la moindre erreur.
- Un **troisième secret** est nécessaire (`FEDAPAY_WEBHOOK_SECRET`), distinct
  des clés API.
- **Aucun formulaire de carte chez nous** : cela nous ferait entrer dans le
  périmètre PCI-DSS. Le parcours retenu est le paiement mobile direct
  (numéro + confirmation USSD, l'école ne quitte pas l'application), avec la
  page hébergée FedaPay en repli.

**Limite connue** : la méthode mobile directe ne documente que `mtn`, `moov`,
`mtn_ci` et `moov_tg`. Au Togo, cela signifie **Flooz, pas T-Money** — à
vérifier côté tableau de bord FedaPay. Le virement et le Mobile Money manuel
restent couverts par `validerPaiement`.

**Piège de la grille publique** : `src/lib/tarifs.ts` n'est pas la source de
vérité de la facturation (`plan_abonnement` et `abonnement_etablissement.
montantTotal` le sont). Il existe parce que `listPlans()` exige une session,
alors que la page de tarifs s'adresse à des visiteurs anonymes. Toute
modification doit être répercutée des deux côtés.

#### Ce que l'intégration FedaPay a appris

**La page de paiement vit sous `/abonnement/` et doit y rester.**
`PATHS_TOUJOURS_ACCESSIBLES` (`src/lib/supabase/middleware.ts`) y laisse passer
les écritures même en lecture seule. Ailleurs, la Server Action de paiement
serait refusée par la garde d'abonnement : le paywall bloquerait exactement les
écoles venues payer.

**Le tenant n'écrit jamais dans `transaction_fedapay`.** La RLS ne lui accorde
que la lecture ; les écritures passent par la clé service-role, depuis un
service gardé ou un webhook signé. Vérifié par une session Directeur réelle :
l'insertion d'une transaction `APPROUVE` est refusée en `42501`, et un `update`
du statut ne modifie aucune ligne.

**Les erreurs du SDK FedaPay ne sont pas des `Error`** — même piège que les
erreurs Supabase. `e instanceof Error` y est faux et `String(e)` donne
« [object Object] ». D'où `estErreurSignature()`, qui teste
`instanceof SignatureVerificationError` et non le texte du message : une
première version testait le message par expression régulière et renvoyait 500
au lieu de 400, ce qui aurait fait rejouer indéfiniment une charge toujours
refusée.

**Idempotence par l'état, pas par un identifiant d'événement.**
`transaction_fedapay.abonnementId` non nul signifie « déjà honorée ». C'est plus
robuste qu'une table d'événements traités, parce que ça résiste aussi à deux
événements distincts portant sur la même transaction. Vérifié de bout en bout
avec une signature réelle (`Webhook.generateTestHeaderString`) : deux envois
identiques n'ouvrent qu'un seul abonnement.

**La page de retour n'active rien.** Elle est atteinte par une redirection de
navigateur, que n'importe qui peut fabriquer en tapant l'URL. Y ouvrir un
abonnement offrirait le produit à qui connaît l'adresse.

**Découvertes de l'intégration, à ne pas réapprendre** :

- **`sendNowWithToken` prend le corps de la requête, pas le numéro.** Le SDK
  fait `params.token = token` puis poste `params` tel quel : il faut lui passer
  `{ phone_number: { … } }`. L'exemple de la documentation officielle écrit
  `sendNowWithToken(mode, token, phone_number)`, ce qui aplatit l'objet et
  produit `400 — Paramètre manquant ou la valeur est vide phone_number`. **Tous
  les paiements échouaient** ; seul un appel à l'API réelle l'a révélé.
- **`momo_test` est le mode du bac à sable**, et « ne dépend pas des serveurs de
  test des opérateurs ». Envoyer `moov_tg` en sandbox sollicite l'infrastructure
  de Moov, qui n'a aucune raison de répondre. Numéros acceptés : `64000001` et
  `66000001`.
- **La protection de déploiement Vercel bloque les webhooks en preview.**
  `vercel_auth_enabled` renvoie un 401 avant d'atteindre le code. Il faut soit
  une exception de chemin sur `/api/fedapay/webhook`, soit tester en production.
- **`tsc --noEmit` attrape ce que lint et vitest ne voient pas.** Le workflow CI
  (`.github/workflows/ci.yml`) enchaîne `lint`, `typecheck` puis `test` : ne
  lancer que les deux extrêmes laisse passer des erreurs de typage, comme un
  `variant="outline"` inexistant sur le `Button` du projet.
- **Pays limités à ceux des moyens de paiement documentés** (Bénin, Togo, Côte
  d'Ivoire). Proposer le Sénégal afficherait un choix qui échouerait au moment
  de payer.
- **Longueurs de numéro en intervalle, pas en valeur exacte** : les plans de
  numérotation ont bougé (dix chiffres au Bénin et en Côte d'Ivoire) alors que
  les numéros de test FedaPay en font huit. Piège à connaître : `22890123` est
  un numéro togolais valide commençant par l'indicatif `228` — l'indicatif ne
  se retire que si ce qui reste garde une longueur plausible.

---

### Fonctionnalité — Console SUPER_ADMIN

**Statut** : ✅ terminée et mergée sur `main` (2026-08-31) — branche
`feat/super-admin`. Aucune migration.

**Objectif** : la console plateforme était superficielle — trois pages, deux
entrées de navigation, et une page racine qui mélangeait un tableau de bord et
un inventaire sans bien faire ni l'un ni l'autre.

**Le trou principal n'était pas esthétique.** `demande_demo` était alimentée
par le formulaire public de la page d'accueil et **lue nulle part**. Chaque
demande de démo — le seul appel à l'action de tout le site — arrivait dans une
table que personne n'ouvrait. La table, son énumération de statuts et ses
policies existaient depuis la migration `0002` ; seul l'écran manquait. À
l'ouverture de la nouvelle page, un prospect réel y attendait depuis 13 jours.

**Livrables** :

- [x] `src/services/plateforme.ts` — métriques agrégées, fiche d'usage d'une
      école, journal d'audit transverse.
- [x] `src/services/demande-demo.ts` — file des prospects et changement de
      statut, journalisé.
- [x] `/super-admin` — tableau de bord : revenu mensuel, encaissements du mois,
      répartition des écoles par état, échéances sous 7 jours.
- [x] `/super-admin/etablissements` — inventaire séparé, enrichi de l'état de
      facturation, des effectifs, des cycles et de l'échéance. Ligne entière
      cliquable.
- [x] `/super-admin/demandes` — prospects classés par ce qu'il y a à en faire,
      pas par date. Marquage « en retard » au-delà de trois jours sans réponse.
- [x] `/super-admin/etablissements/[id]` — usage réel : effectifs, classes,
      enseignants, dernière activité, cycles, essai, transactions FedaPay.
- [x] `/super-admin/journal` — audit toutes écoles, filtres par module, école
      et action, paginé à 50.
- [x] Le SUPER_ADMIN est redirigé de `/dashboard` vers sa console au lieu d'un
      écran vide. La route reste : elle sert aux quatre autres rôles.
- [x] Navigation : de deux entrées à cinq.

**Principes retenus** :

- **Le super-admin ne voit aucune donnée d'élève, de note ou de facture.** Il
  voit des états, des effectifs et des dates. L'isolation entre écoles est la
  promesse du produit ; la console ne doit pas être le trou par lequel elle
  fuit. Une prise en main pour le support a été explicitement écartée.
- **L'état affiché suit l'ordre de `evaluerAcces`** — suspension, puis
  abonnement payé, puis essai. Une console qui contredirait l'accès réel de
  l'école serait pire qu'une console vide.
- **Le revenu vient de `montantTotal`**, figé à la souscription, jamais du
  catalogue : recalculer depuis `plan_abonnement` réécrirait rétroactivement le
  revenu constaté à chaque changement de prix.
- **Les effectifs se comptent sur `inscription` en statut ACTIVE**, pas sur la
  table `eleve` qui accumule les élèves partis.
- Les filtres du journal passent par l'URL : une recherche se partage, la page
  reste rendue côté serveur, et on évite `useSearchParams` qui imposerait une
  frontière `Suspense`.

**Constats laissés ouverts** :

- Deux modules inattendus, **`debug` et `test`**, écrivent dans le journal
  d'audit de production. À examiner.
- Le doublon « Les Victorieux » vide a été **supprimé** le 2026-08-31, après
  vérification par les deux chemins de rattachement (colonne `etablissementId`
  et parents `classe`/`facture` pour `evaluation`, `note` et `paiement`).

---

### Fonctionnalité — Emploi du temps

**Statut** : ✅ livrée sur `feat/emploi-du-temps` (2026-09-01), en attente de
merge. Migration `0018`.

**Objectif** : donner à chaque classe sa grille hebdomadaire, modifiable à tout
moment par la Secrétaire, et imprimable.

**La décision structurante est l'absence d'horaires.** Les colonnes sont les
jours (lundi à samedi), les lignes des rangs ordonnés — « Première heure » à
« Huitième heure ». Une école togolaise n'a pas de journée type universelle :
07h00 ici, 07h30 là, une pause à géométrie variable. Imposer une grille horaire
obligerait chaque établissement à décrire sa journée avant de pouvoir placer le
moindre cours, et le rang suffit à dire « ce cours vient avant celui-là », qui
est la seule information dont l'affichage a besoin.

**Conséquence heureuse** : les deux conflits qui comptent deviennent des
contraintes d'unicité, pas des calculs de chevauchement. Ni `btree_gist`, ni
`EXCLUDE USING gist`, et surtout aucun risque de saisie concurrente qui
passerait entre deux vérifications applicatives.

**Livrables** :

- [x] Migration `0018` — `emploi_du_temps_creneau`, deux index uniques
      (classe/case, et enseignant/case en index **partiel**), RLS tenant.
- [x] `src/services/emploi-du-temps.ts` — lecture de grille, pose (upsert),
      retrait, détection de conflit. PIN exigé et audit sur les deux écritures.
- [x] `src/lib/emploi-du-temps.ts` — forme et vocabulaire, sans dépendance.
- [x] Grille cliquable en bas de `/etablissement/classes/[id]`.
- [x] Export PDF A4 paysage, avec logo et filigrane de l'établissement.
- [x] Ligne entière cliquable dans la liste des classes.
- [x] La carte « La gestion des inscriptions arrive en Phase 2 » liste
      désormais les élèves réellement inscrits.

**Principes retenus** :

- **Le conflit d'enseignant est annoncé puis refusé.** La vérification préalable
  produit une phrase lisible pendant la saisie (« assure déjà Mathématiques en
  3ème A ») ; l'index unique refuse l'écriture. La première sert le confort, le
  second la correction — deux secrétaires saisissant en même temps passeraient
  l'une, jamais l'autre.
- **L'index de l'enseignant est partiel.** Un créneau peut n'avoir aucun
  enseignant affecté — on place souvent la matière avant de savoir qui l'assure
  — et NULL ne doit pas entrer en conflit avec NULL.
- **Suppression franche assumée.** Un créneau n'est ni une note, ni une facture,
  ni une inscription. L'invariant « pas de suppression dure » protège les
  données financières et académiques historisées ; un emploi du temps est un
  réglage courant, réécrit plusieurs fois par trimestre. L'audit garde la trace.
- **Les matières proposées sont celles du programme du niveau.** Placer une
  matière hors programme produirait un emploi du temps que le bulletin
  ignorerait.
- **PIN exigé** parce que la Secrétaire modifie sans validation hiérarchique.

**Pièges rencontrés** :

- `getClasse` accepte le COMPTABLE, pas `listElevesInscritsClasse` ni
  `listCreneauxClasse`. Appeler sans conditionner au rôle faisait échouer toute
  la page pour ce rôle. Restreint côté page plutôt qu'en élargissant une garde.
- **`/api/emploi-du-temps` manquait dans `outputFileTracingIncludes`.** Toute
  fonction qui génère un PDF doit y figurer : le tracing omet les assets brotli
  de `@sparticuz/chromium`, lus à l'exécution et jamais `require`d. En local le
  chemin serverless n'est pas emprunté — l'export aurait échoué **en production
  seulement**.
- Le gabarit PDF importait le service pour trois constantes, tirant tout le
  graphe serveur dans un générateur de HTML. D'où `src/lib/emploi-du-temps.ts`.

**Reste à faire** :

- L'enseignant ne voit pas encore « son » emploi du temps toutes classes
  confondues. L'index est en place, l'écran manque.

---

### Fonctionnalité — Robustesse du build (Sentry, polices)

**Statut** : ✅ livrée sur `feat/emploi-du-temps` (2026-09-01). Aucune migration.

**Objectif** : un build ne doit dépendre d'aucun service tiers. Le 2026-09-01,
un déploiement a mis **trente minutes** sans la moindre erreur de compilation.

**Deux attentes réseau, indépendantes** :

- `sentry-cli releases new` est resté bloqué 3 min 26 avant un `504 Downstream
  timeout` de sentry.io. Un incident chez un tiers immobilisait la livraison.
- `next/font/google` téléchargeait Inter et JetBrains Mono **pendant le build**.
  Un `ECONNRESET` sur `fonts.gstatic.com` laissait Next en réessais.

**Livrables** :

- [x] `errorHandler` sur le plugin Sentry — un échec d'envoi de source maps
      devient un avertissement. Télémétrie du plugin coupée.
- [x] Polices auto-hébergées via `next/font/local`, fichiers dans
      `src/app/fonts/` avec `OFL.txt`.

**Ce que l'auto-hébergement ne change pas** : `next/font/google` servait déjà
les fichiers depuis notre domaine (`_next/static/media/`), jamais depuis Google.
Seule l'origine **au moment du build** change. La sortie est identique,
métriques de police de repli comprises.

**Détails qui coûtent une compilation si on les oublie** :

- Le chargeur de polices exige des **littéraux** : `unicode-range` factorisé
  dans une constante partagée fait échouer le build (`Font loader values must be
  explicitly written literals`). La valeur est donc répétée dans les deux
  appels.
- Sans `unicode-range`, un caractère hors du sous-ensemble latin s'afficherait
  en carré vide au lieu de tomber sur la police de repli.
- Les `.woff2` sont ceux produits par Next lui-même lors du dernier build
  réussi — un rendu identique, plutôt qu'une version retéléchargée.

**Effet de bord bienvenu** : `.next/static/media` ne contient plus que deux
fichiers au lieu de treize ; les sous-ensembles cyrillique, grec et vietnamien
n'étaient jamais servis.

**Constat laissé ouvert** : rien ne prouve que les polices étaient en cause dans
les trente minutes **sur Vercel** — le log fourni s'arrêtait à l'erreur Sentry.
Seul l'`ECONNRESET` local est établi. À confirmer au prochain déploiement.

---

### Fonctionnalité — Coefficients officiels du ministère

**Statut** : ✅ livrée sur `feat/coefficients-officiels` (2026-09-02).
Migrations `0020` à `0022`.

**Objectif** : les coefficients ne sont pas une donnée d'établissement, ils sont
fixés au niveau national. Le Directeur remplissait une grille niveau × matière
avant de pouvoir éditer le moindre bulletin, sans avoir la moindre latitude sur
les valeurs.

**Sources** : documents du Ministère des Enseignements Primaire, Secondaire,
Technique et de l'Artisanat, applicables à compter de 2022-2023, fournis par
l'utilisateur.

**Livrables** :

- [x] `0020` — `matiere_officielle` et `coefficient_officiel`, catalogues
      système sans `etablissementId`. Semis du collège et du lycée.
- [x] `0021` — retrait de `matiere.matiereOfficielleId`, rattachement par le
      code.
- [x] `0022` — `codeEcole`, pour les disciplines que le ministère renomme d'un
      cycle à l'autre.
- [x] `src/services/matiere-officielle.ts` — lecture du catalogue et
      `appliquerCoefficientsOfficiels`.
- [x] Onboarding : étape Matières sur le catalogue officiel, barème appliqué à
      la fin de l'étape Programme, étape Coefficients réduite aux matières
      libres.
- [x] Écran Coefficients : mention « Barème national » par ligne, bouton
      d'application.
- [x] Correction du moteur : un trimestre sans aucune note vaut `null`.

**Décisions consignées** :

- **La copie plutôt que la lecture au vol.** Le catalogue est une valeur par
  défaut à la configuration de l'année ; le coefficient qui compte reste dans
  `coefficient_matiere`. Sinon une révision du barème ministériel réécrirait
  rétroactivement tous les bulletins déjà édités. Même raisonnement que
  `abonnement.montantTotal`.
- **Une matière sélectionnée ne peut pas avoir zéro** — `check (coefficient > 0)`
  en base. L'absence de barème se dit par l'absence de ligne.
- **Trois zones non couvertes**, où l'école garde la saisie manuelle : les séries
  techniques (E, F, G), absentes des documents ; la Seconde, dont les totaux ne
  se recoupent pas avec la lecture des cellules ; et les matières à volume
  horaire sans coefficient (Dessin, Musique, Langues nationales, Enseignement
  ménager).
- **La migration porte sa propre somme de contrôle** : un bloc `do $$` compare
  les coefficients semés aux totaux du ministère et lève si une colonne ne tombe
  pas juste.

**Vérifié** : parcours `/demarrage` déroulé de bout en bout sur un établissement
vide — l'étape Coefficients se franchit toute seule, la base contient le barème
exact de la 3ème (total 18). Puis un élève inscrit, huit notes posées, et le
bulletin PDF comparé à un calcul fait à la main : **TOTAL 18 / 222, moyenne
12,33/20**, concordance parfaite.

**Le bug trouvé par cet oracle** : le bulletin affichait « moyenne annuelle
4,11 » pour un élève à 12,33 — soit 12,33 ÷ 3, les trimestres à venir étant
comptés zéro. `moyenneTrimestrielle` renvoyait 0 pour un trimestre sans aucune
note. Tout bulletin de 1er trimestre déjà édité porte donc une moyenne annuelle
fausse ; un PDF étant figé, ils ne se corrigent pas rétroactivement.

**Régénération des bulletins de démonstration** (2026-09-02) : les 62 anciens
bulletins des Victorieux sont passés en `OBSOLETE` — le statut existait déjà
dans `statut_document` — et 76 ont été régénérés (1ère D, 6ème A, 6e A au 1er
trimestre, Tle C au 3e).

Deux constats de cette opération :

- **`genererBulletin` crée toujours un nouveau document**, il ne remplace jamais.
  Régénérer sans marquer les anciens obsolètes laisse plusieurs bulletins par
  élève sans qu'on sache lequel fait foi.
- **La génération groupée traite toute la classe**, pas seulement les élèves qui
  avaient déjà un bulletin : 76 produits là où 24 étaient attendus.

**Correction d'une affirmation trop large** : il avait été annoncé que tous les
bulletins déjà édités portaient une moyenne annuelle fausse. C'est inexact. Le
défaut ne se déclenche que si un trimestre n'a **aucune** note ; or les
Victorieux ont des notes sur les trois trimestres (12,33 / 12,12 / 11,96 en
1ère D), donc leur moyenne annuelle était déjà juste. Ce qui a changé sur ces
bulletins, ce sont les **coefficients**, désormais alignés sur le barème
national. Le bug reste réel et touchera toute école en cours d'année — cas
normal en usage réel — mais il ne touchait pas ces données.

**Reste ouvert** :

- Les deux colonnes de la Seconde. Une seule ligne est mal lue parmi Français,
  Histo-Géo, Éducation civique, Langue vivante 1 et Mathématiques ; l'écart est
  de +1 sur les deux colonnes. À vérifier sur le document papier.

---

### Fonctionnalité — Import en deux temps

**Statut** : ✅ livrée (2026-09-02) — branche `feat/contact-support`.

**Objectif** : ne plus écrire à l'aveugle. Le dépôt d'un fichier déclenchait
l'écriture immédiate ; on analyse désormais, on montre le bilan, et rien n'est
enregistré tant que l'utilisateur n'a pas confirmé.

**Le défaut qui l'a motivé.** Rien dans la chaîne ne détectait un élève déjà
présent : aucune recherche avant l'insertion, une unicité en base portant sur
le seul matricule — un compteur `max+1`, donc structurellement incapable de
rejouer une valeur — et le garde-fou de `fn_inscrire_eleve` qui teste
l'identifiant élève, neuf par construction. Un fichier redéposé pour corriger
trois lignes recréait les 230 autres **en entier** : élève, responsable,
inscription et facture. Effectifs faux sur tous les tableaux de bord, double
facturation, et un nettoyage qui passe par des statuts `ANNULE` puisque
l'invariant interdit la suppression dure.

**Livrables** :

- [x] `src/lib/import/entetes.ts`, `analyse.ts` — sans dépendance, affichés
      côté client. `excel.ts` — lecture partagée, serveur uniquement.
- [x] Les trois importateurs passent en deux temps : `preparerImport*` (lecture
      seule) puis `executerImport*`.
- [x] Détection des doublons sur les élèves, en base **et** dans le fichier.
- [x] `ApercuImport` — trois états : colonnes non reconnues, bilan avant
      confirmation, rapport final.
- [x] Colonnes non reconnues : bouton d'envoi du fichier au support.
- [x] 25 tests, dont un classeur construit en mémoire.
- [x] Deux classeurs de test fournis (conforme, colonnes erronées).
- [ ] Vérification par le chemin réel : import joué de bout en bout.

**Décisions consignées** :

- **`preparerImport*` est la seule source de vérité.** L'écran de bilan et
  l'écriture l'appellent tous deux ; l'écriture ne touche que les lignes
  marquées `PRETE`. Décider deux fois, à deux endroits, finirait par afficher
  un bilan que l'écriture contredit.
- **Le fichier est relu et réanalysé à la confirmation**, jamais repris depuis
  le navigateur : une analyse renvoyée par le client est une décision que
  l'appelant peut réécrire. Conséquence assumée — si les données ont changé
  entre les deux temps, c'est l'état à l'écriture qui fait foi.
- **Trois catégories distinctes : prête, doublon, refusée.** Confondre doublon
  et refus afficherait « 230 échecs » sur un fichier redéposé où tout s'est
  bien passé. Un bilan alarmant sur une opération réussie apprend à ne plus
  lire les bilans.
- **L'ensemble des identités grandit au fil du fichier.** Le charger une fois
  avant la boucle ne suffit pas : un classeur contenant deux fois la même ligne
  verrait la seconde passer. Verrouillé par un test.
- **Aucune contrainte d'unicité en base.** Deux élèves réels peuvent partager
  nom, prénoms et date de naissance ; une contrainte refuserait une inscription
  légitime sans recours. La détection écarte d'un import de masse, la saisie
  individuelle reste ouverte.
- **Pas de détection de doublons sur les paiements**, délibérément. Deux
  versements identiques le même jour sont légitimes — deux tranches réglées
  matin et après-midi — et les refuser ferait disparaître de l'argent
  réellement encaissé.
- **Le contrôle des en-têtes court-circuite tout le reste.** Un fichier dont la
  colonne s'appelle « Date de naissance » produirait 230 fois la même erreur
  Zod, pour un unique problème situé en ligne 1.
- **La casse et l'ordre des colonnes sont tolérés**, le reste non. Les clés
  sont normalisées à la lecture, sinon le contrôle d'en-têtes accepterait
  « Nom » que la lecture, elle, ne trouverait pas.

**Limite connue** : pour les enseignants et les paiements, l'analyse résout ce
qu'elle peut en lecture (classe, matricule, facture) mais ne peut pas
anticiper un dépassement de solde, qui dépend du cumul des lignes. Le rapport
final le dira.

**Reste** : `parseFichierExcel` a disparu des trois services au profit de
`lireClasseur` — aucun appelant hors dépôt, mais c'est une rupture d'API.

### Fonctionnalité — Contact support

**Statut** : ✅ livrée (2026-09-02) — branche `feat/contact-support`.
Migrations `0023` et `0024` **appliquées**.

**Objectif** : donner à une école un moyen de joindre la plateforme depuis le
produit. `/profil/aide` répondait à sept questions figées et s'arrêtait là :
une école bloquée sur autre chose n'avait aucun recours.

**Livrables** :

- [x] Migration `0023` — `support_demande`, énumérations `categorie_support` et
      `statut_support`, policies RLS.
- [x] `src/services/support.ts` — dépôt, lecture par école, file plateforme,
      réponse, changement de statut. Six gardes à la matrice.
- [x] `/profil/support` — formulaire + historique des demandes de l'école.
- [x] `/super-admin/support` — file à traiter / en cours / closes, réponse
      inline.
- [x] Entrées de navigation (bas de sidebar pour tous, entrée dédiée
      SUPER_ADMIN) et renvoi depuis `/profil/aide`.
- [x] Pièce jointe (migration `0024`) : bucket privé `support`, dépôt par la
      clé service-role, lien signé de 5 minutes pour le téléchargement.
- [x] File de travail : cartes-filtres cliquables (à traiter / en cours /
      closes / toutes), recherche, filtres par catégorie, icône et teinte par
      catégorie, alerte sur la plus ancienne demande sans réponse.
- [x] Accès par bulle flottante desktop ; `ITEM_SUPPORT` rattaché au menu
      « Plus » mobile.
- [x] Skill `scolargest-inputs` (hors dépôt, `~/.claude/skills/`) : remise en
      forme d'un classeur quelconque vers les gabarits d'import.
- [ ] Vérification par le chemin réel : pages ouvertes, dépôt et réponse joués
      de bout en bout.

**Décisions consignées** :

- **La page vit sous `/profil/support` délibérément.** `/profil` figure dans
  `PATHS_TOUJOURS_ACCESSIBLES` : une école passée en lecture seule peut donc
  encore écrire au support — c'est précisément celle qui en a le plus besoin.
  Déplacer cette page ailleurs refermerait le canal au pire moment, sans erreur
  visible nulle part.
- **La demande est portée par l'établissement, pas par l'auteur.** Le Directeur
  relit ce que sa Secrétaire a envoyé ; sinon le même ticket se rouvre en
  double la semaine suivante.
- **L'identité de l'auteur est figée à l'envoi** (nom, email, rôle). Un compte
  change de rôle ou est désactivé ; la demande doit continuer de dire qui l'a
  écrite et à quel titre. Même raisonnement que l'historisation des tarifs.
- **Les quatre rôles école peuvent écrire.** Le blocage arrive chez celui qui
  saisit, pas chez le Directeur ; le faire transiter par la direction retarde
  et déforme.
- **`statut` et `reponseSupport` ne sont écrivables que par le SUPER_ADMIN**
  (policy `for update`). Laisser l'école les écrire lui permettrait de se
  répondre à elle-même ou de refermer une demande que personne n'a traitée.
- **Une seule réponse, pas un fil de discussion.** Un fil demanderait une table
  de messages, des notifications et une notion de « non lu ». Rien n'empêche de
  l'ajouter plus tard.
- **`pageOrigine` est repris de `?depuis=`**, et seulement s'il commence par
  `/` : on ne stocke pas de domaine et on ne rend pas cliquable ce qu'un tiers
  pourrait injecter.

**Piège rencontré** : le générateur de `Docs/11-Matrice-permissions.md` lit les
appels `requireRole` **textuellement**. Un tableau de rôles déplié dans l'appel
ressort en « DYNAMIQUE », donc invérifiable — et un commentaire citant cette
forme suffit à déclencher la même détection. Les rôles s'écrivent en toutes
lettres dans l'appel.

**Reste** : notification du support à l'arrivée d'une demande (aujourd'hui il
faut ouvrir l'écran), et compteur de demandes en attente sur `/super-admin`.

### Fonctionnalité — Statistiques académiques

**Statut** : ✅ terminée et mergée sur `main` (2026-09-01) — branche
`feat/kpi-graphes`. Aucune migration.

**Objectif** : une vraie lecture des résultats — réussite par classe,
répartition filles/garçons, matières à renforcer — « dans la limite du
raisonnable », pour ne pas donner à quelqu'un des chiffres qu'il ne saura pas
interpréter.

**Ce qu'on a refusé de mesurer.** Pas de statistiques par enseignant. La
moyenne des classes d'un professeur ne mesure pas son travail : elle mêle la
difficulté de la matière, le niveau du groupe hérité et l'effectif. Le chiffre
serait lu comme un classement et se retournerait contre son sujet. Écarté
explicitement, à rouvrir seulement si le besoin se précise.

**Livrables** :

- [x] `src/lib/statistiques.ts` — agrégation pure, sans dépendance. 9 tests.
- [x] `src/services/statistiques-academiques.ts` — garde Directeur + Secrétaire.
- [x] `/statistiques` — quatre métriques, matières à renforcer, distribution,
      résultats par classe, filles/garçons, sélecteur de trimestre.
- [x] Entrée « Statistiques » dans la navigation des deux rôles.
- [x] `BarresHorizontales` : largeur de libellé réglable.

**Décisions consignées** :

- **Le seuil de réussite est 10**, repris du barème d'appréciation existant. Un
  seuil inventé contredirait l'appréciation imprimée sur le bulletin du même
  élève. Idem pour les tranches, nommées comme les appréciations.
- **Un élève sans moyenne n'entre dans aucun calcul.** Le compter zéro ferait
  plonger la moyenne d'une classe dont les notes ne sont pas encore saisies.
  Deux compteurs distincts et un avertissement quand ils divergent.
- **Les moyennes viennent de `getResultatsClasse`**, pas d'un recalcul. Une page
  à 11,2 et une autre à 11,4 détruiraient la confiance dans les deux.
- Chaque matière porte son **écart à la moyenne générale** : 9,5 est faible dans
  un établissement à 13, banal dans un à 9.
- La répartition filles/garçons porte une phrase rappelant qu'un écart décrit
  une situation sans l'expliquer.

**Vérifié à l'écran** sur les données réelles : moyenne 11,73/20, 73 % de
réussite, 276 évalués, bascule de trimestre fonctionnelle, et un COMPTABLE
forçant l'URL renvoyé sur son tableau de bord.

**Reste ouvert** : l'écran n'a pas été vu sur mobile, et le rôle Enseignant n'a
pas de vue équivalente sur ses propres classes.

---

### Fonctionnalité — KPI, graphes et refonte des tableaux de bord

**Statut** : ✅ terminée (2026-09-01) — branche `feat/kpi-graphes`.
Migration `0019`.

**Objectif** : rendre les statistiques lisibles d'un coup d'œil. Les données
existaient déjà ; c'est leur restitution qui était pauvre — des nombres dans
des cartes, aucune tendance.

**Le cadrage de la veille était trop pessimiste.** Il notait « aucune table
n'historise l'état de la plateforme ». C'est vrai de l'*état*, pas des *flux* :
`paiement.datePaiement`, `inscription.dateInscription` et
`paiement_abonnement.date` portent leur propre date et reconstituent l'exact,
mois par mois. Aucune table d'instantanés n'a été nécessaire.

**Livrables** :

- [x] `src/services/series-ecole.ts` — encaissements et effectifs par classe,
      calés sur l'année scolaire, avec comparaison à l'année précédente.
- [x] `getEncaissementsPlateforme` — série mensuelle de la plateforme, tirée de
      `paiement_abonnement.date`.
- [x] `src/lib/graphes.ts` + quatre primitives SVG, sans dépendance.
- [x] `src/components/ui/carte-metrique.tsx` — cartes de métrique partagées.
- [x] Les cinq tableaux de bord refondus.
- [x] Migration `0019` — cohérence du passage de cohorte.

**Décisions consignées** :

- **Pas de bibliothèque de graphes.** Préférence exprimée pour l'esthétique :
  on contrôle chaque trait plutôt que de combattre un style par défaut, et le
  bundle ne grossit pas.
- **Interpolation monotone**, pas Catmull-Rom : une spline ordinaire plongerait
  sous la ligne de base entre un mois vide et un gros mois, affichant des
  recettes négatives.
- **L'année scolaire plutôt que douze mois glissants.** « Les Victorieux » a
  inscrit ses 283 élèves en septembre 2025 : la fenêtre glissante rendait
  l'histogramme entièrement vide, d'un mois.
- **L'histogramme des inscriptions a été supprimé** après mise en service : dans
  une école tout le monde s'inscrit en septembre, on connaissait l'allure de la
  courbe avant de la tracer. Remplacé par l'effectif par classe, replié par
  défaut.
- **Palette validée par script**, pas à l'œil. La séparation tritan reste dans
  la bande plancher, ce qui impose un encodage secondaire — d'où les étiquettes
  directes dans la légende.

**Trois pannes en production, toutes invisibles au build** :

- `paiement` **ne porte pas** de colonne `etablissementId` — il est rattaché au
  tenant par sa facture. Filtrer dessus lève, et le tableau de bord entier
  tombait. Même piège que lors de la suppression du doublon d'établissement.
- **Une fonction passée à un composant client** (`formater={fcfa}`) lève
  « Functions cannot be passed directly to Client Components » à l'exécution
  seulement : `tsc` accepte, ESLint ignore la frontière, et `/dashboard` est
  rendu à la demande.
- `/api/emploi-du-temps` manquait dans `outputFileTracingIncludes`.

**Deux régressions de mise en page, vues seulement à l'écran** : les raccourcis
coincés dans une colonne de trois cinquièmes tombaient à un mot par ligne, et
cinq libellés français dans cinq colonnes égales se chevauchaient.

**Constats laissés ouverts** :

- L'audit du passage de cohorte est global et ne dit pas qui a été admis.
- `proposerDecisions` suggère `DEPART` quand le niveau n'a pas de suivant :
  depuis le recentrage sur le secondaire, une école encore en CM2 verrait
  « départ » proposé pour toute sa classe.
- Les rôles **Secrétaire et Enseignant** et le **mobile** n'ont pas été ouverts.
- L'extracteur de la matrice de permissions délimite le corps d'une fonction
  jusqu'au prochain `export function` ; un `export interface` ne l'arrête pas,
  et une fonction pure peut hériter des gardes de ses voisines. Contourné en
  plaçant les fonctions pures en fin de fichier ; le défaut demeure.

---


### Fonctionnalité — Bulletins : mise en page, bulletins prêts, téléchargement groupé

**Statut** : ✅ terminée et mergée sur `main` (2026-09-02) — branche
`feat/bulletin-mise-en-page`. Migration `0025`.

**Objectif** : rendre le bulletin PDF régulier d'un élève à l'autre, et donner
un endroit où voir les bulletins produits — l'application n'en avait aucun.

**Le manque de fond.** L'écran de génération ne listait que les élèves à
traiter. Le PDF s'ouvrait dans un onglet puis disparaissait de l'application :
impossible de savoir qui avait déjà son bulletin, donc on régénérait à
l'aveugle. Une seule classe portait 61 versions remplacées au premier
trimestre.

**Obstacle rencontré.** `document` ne portait ni période, ni classe, ni année :
un bulletin en base ne savait pas de quel trimestre il était. L'information
n'existait que dans le journal d'audit. La migration `0025` ajoute les trois
colonnes et reprend l'existant depuis ce journal — **146 bulletins sur 146**
repris, aucun orphelin. Les colonnes restent nullables : un reçu n'a pas de
trimestre, et un document sans ligne d'audit reste sans période plutôt que de
s'en voir attribuer une au hasard.

**Livrables** :

- [x] Hauteurs de ligne égales sur le bulletin secondaire, calculées au rendu à
      partir du seul nombre de matières ; contenu plafonné au lieu de pousser la
      ligne ; page toujours pleine par `flex:1`, sans lignes anonymes.
- [x] Pied de page réorganisé : un seul bloc « Résultats », la moyenne de la
      période n'y figure plus deux fois sous deux noms différents.
- [x] Migration `0025` — `periode`, `classeId`, `anneeScolaireId` sur `document`.
- [x] `listBulletinsClasse()` — garde Directeur, Secrétaire, Comptable.
- [x] `/etablissement/notes/bulletins/generes` — bulletins prêts et manquants,
      partant des élèves inscrits et non des documents.
- [x] Statut « Prêt » / « À générer » par élève sur l'écran de génération.
- [x] Téléchargement groupé dans un dossier choisi (`showDirectoryPicker`), un
      PDF par élève ; repli ZIP sans dépendance (`src/lib/zip.ts`, 15 tests).
- [x] `scripts/apercu-bulletin.ts` — rendu du gabarit sans base ni session.

**Trois pièges consignés** :

- `window.open(url, '_blank', 'noopener')` renvoie `null` **même en cas de
  succès** : le message « fenêtre bloquée » s'affichait à chaque téléchargement
  réussi.
- Des backticks dans un commentaire CSS **à l'intérieur d'un template literal**
  terminent la chaîne et cassent la compilation.
- `networkidle` ne se stabilise jamais en développement (websocket HMR).

**Reste ouvert** :

- La case **Statut** du bulletin (Redoublant / Nouveau) est toujours vide. Elle
  est déductible du `decisionFinAnnee` de l'année précédente, mais un élève
  venu d'un autre établissement serait affiché « Nouveau » à tort. Laissée à
  remplir à la main, décision non tranchée.
- Le sélecteur de dossier n'existe pas sur Firefox, Safari ni mobile : le ZIP
  reste le repli, et Chrome refuse les dossiers système.

---

### Fonctionnalité — Abonnement et essai : restructuration

**Statut** : ✅ terminée et mergée sur `main` (2026-09-03) — branche
`feat/soko-abonnements`. Migrations `0026` et `0027`.

**Objectif** : rendre l'essai gratuit et l'abonnement réellement fonctionnels
de bout en bout, du démarrage d'une école neuve à la relance avant échéance.

**Le défaut n° 1 : aucune école ne pouvait commencer son essai.** Un
établissement neuf n'a pas d'abonnement, donc `evaluerAcces` le mettait en
lecture seule, donc le middleware refusait les écritures de `/demarrage` — or
l'essai démarre à la définition du PIN, *dans* `/demarrage`. Blocage circulaire,
masqué jusque-là parce que `seed-onboarding-test.ts` forçait un abonnement
ACTIF. Le script ne le fait plus : une école de test naît nue, comme une vraie.

**Livrables** :

- [x] `evaluerAcces` à six niveaux — ajout d'`AVERTISSEMENT` (échéance ≤ 30
      jours, bandeau sans blocage) et d'`AVANT_ESSAI` (école neuve).
- [x] Dérogation `/demarrage` dans le middleware, conditionnée aux **deux**
      dates d'essai absentes, sans abonnement ni suspension.
- [x] Migration `0026` — suspension portée sur `etablissement` (`suspenduLe`,
      `motifSuspension` ≥ 10 caractères), `fn_proteger_facturation` étendue aux
      colonnes de suspension, table `relance_abonnement`.
- [x] Migration `0027` — `montantTotal NOT NULL`, reposée après déploiement.
- [x] `ouvrirPeriode` / `enregistrerReglement` / `suspendreEtablissement(motif)`
      / `leverSuspension` / `prolongerEssai` remplacent les cinq fonctions
      d'origine ; motif de suspension affiché au Directeur et à la Secrétaire.
- [x] Formules d'abonnement suivant les cycles activés
      (`src/lib/abonnement-formule.ts`, sans dépendance) ; `cyclesFactures()`
      filtre `cycle.disponible`.
- [x] Relances quotidiennes — `/api/abonnements/echeances`, cron Vercel 07h00,
      `CRON_SECRET`, paliers J-7/3/1/0 (essai) et J-15/7/1/0 (abonnement),
      unicité `(école, sujet, palier, échéance)` contre le rejeu.
- [x] `src/lib/email.ts` — envoi applicatif via l'API Resend, qui ne levait
      jamais d'exception jusqu'ici parce qu'il n'existait pas (Resend n'était
      câblé que comme SMTP de Supabase Auth).
- [x] Rappel de fin d'essai en J-7/J-3/J-1, refus mémorisé à la journée.
- [x] Contournement du paiement en ligne tant que `PAIEMENT_EN_LIGNE` ≠ `ACTIF`
      — période ouverte par autorisation de la plateforme, `montantTotal: 0`,
      aucune ligne `paiement_abonnement`.

**Pièges consignés** :

- **Une contrainte suit le code, jamais l'inverse.** `montantTotal NOT NULL`
  posée depuis une branche a cassé la création d'abonnement **en production** :
  la base est partagée par tous les déploiements, une branche ne l'est pas.
- **`setMonth` déborde** — un 31 janvier donnait le 3 mars, soit un mois offert.
  `finDePeriode` ramène au dernier jour du mois cible, en UTC.
- **`AVANT_ESSAI` sur une seule date** faisait repasser une école dont l'essai
  était terminé pour une école neuve. Défaut trouvé par un test existant.
- Un test de sécurité annoncé « FAILLE » l'avait été sur une école **non
  suspendue** : `null → null` ne déclenche pas le trigger. Refait correctement,
  toutes les gardes tiennent.

**Reste ouvert** :

- Trois variables Vercel en production : `CRON_SECRET` et `EMAIL_EXPEDITEUR` à
  déclarer ; `PAIEMENT_EN_LIGNE` à **ne pas** déclarer tant que FedaPay n'est
  pas validé.
- Aucune réconciliation si un webhook FedaPay se perd — à traiter au passage
  au réel.
- Divergence constatée entre le JWT et la table `utilisateur`, non ouverte.

---

### Fonctionnalité — Programme par filière

**Statut** : ✅ terminée et mergée sur `main` (2026-09-03) — branche
`feat/soko-programme-filieres`. Aucune migration.

**Objectif** : cesser de confondre les filières d'un même niveau. « Seconde »
n'est pas un programme : la Seconde A4, la Seconde C et la Seconde D
n'enseignent ni les mêmes matières ni les mêmes coefficients.

**Le défaut avait deux faces.** L'étape « programme » de `/demarrage` groupait
par niveau, imposant une liste unique à trois filières ; et `bulletin-donnees`
imprimait toutes les matières du programme du niveau, y compris à coefficient
nul — un bulletin de Seconde C listait les matières propres à la A4, ligne
vide, sur le document remis à la famille.

**Aucune migration : le modèle prévoyait déjà tout.**
`programme_etablissement` reste unique sur (établissement, niveau, matière) —
la ligne est l'union des filières du niveau — et la différenciation se joue sur
`coefficient_matiere.serieId`, où une matière sans coefficient vaut 0 et sort
de la moyenne. Chaîne vérifiée dans le code plutôt que dans la documentation :
`listCoefficients` filtre sur la série exacte, `bulletin-donnees` rabat
l'absence sur `0`, `calcul-moyennes:81` fait `if (coefficient <= 0) continue`.

**Livrables** :

- [x] `src/lib/filiere.ts` — sans dépendance, donc importable côté client :
      `combinaisonsEnseignees()`, clé `niveauId|serieId`, libellés. 11 tests.
- [x] `EtapeProgramme` par filière, pré-coché d'après le barème national quand
      il couvre la combinaison ; tout coché hors barème (série technique,
      niveau non couvert), le tronc commun restant la règle.
- [x] Validation bloquée si une filière se retrouve sans aucune matière.
- [x] `retirerMatieresHorsFiliere()` — appelée **après** le barème, sans quoi
      celui-ci réintroduirait la matière que le Directeur vient de décocher.
- [x] Filtre du bulletin, sur l'**absence** de coefficient et pour les seules
      classes à série : un zéro explicite est une décision de l'école, et au
      collège une matière sans coefficient signale une configuration inachevée.

**DoD** : deux séries de Seconde ouvertes à l'étape « classes » produisent deux
blocs distincts à l'étape « programme », et un bulletin de Seconde C ne porte
aucune matière étrangère à la filière.

---

### Fonctionnalité — Refonte visuelle : accueil, connexion, en-tête de liste

**Statut** : ✅ terminée et mergée sur `main` (2026-09-03) — branche
`design/verni-hero`, agent VERNI. Aucune migration, aucun service touché
(l'instantané de la matrice de permissions est resté inchangé, ce qui le
confirme).

**Objectif** : monter le niveau de finition de tout ce qui se voit — page
publique, écran de connexion, en-tête des listes, navigation — sans ajouter
la moindre dépendance au bundle.

**Hero plein écran, indépendant du zoom.** `min-h-svh` plutôt que `100vh` (la
barre d'URL mobile ne recadre plus le bas), et des tailles en
`clamp(rem, vw, rem)` plutôt qu'une échelle par paliers `sm:`/`lg:`. Un zoom
navigateur réduit la largeur du viewport en pixels CSS : les `vw` suivent, donc
la composition se contracte au lieu de déborder sous la ligne de flottaison.

**Le vide sous la capture** venait d'une hauteur fixe en `clamp()`, sans rapport
avec la hauteur restante du hero : dès que l'écran était plus haut que prévu,
une bande vide séparait le bas du cadre du bas de l'écran. Le cadre prend
désormais l'espace restant (`flex-1`) et l'image le remplit
(`h-full object-cover object-top`).

**Toutes les mesures valent 80 % du premier jet** — largeurs maximales des
conteneurs comprises, et coefficients `vw`/`vh`. Réduire la seule typographie
ne reproduit pas un rendu à 80 % de zoom : les conteneurs restent à leur
échelle.

**Animations sans bibliothèque.** `Reveal` (IntersectionObserver, déjà dans le
dépôt) pour l'apparition au scroll, transitions CSS sur `group-hover` pour le
reste. La page publique est justement celle qu'on veut la plus légère.

**Livrables** :

- [x] Navbar en pilule flottante, survol en verre. Le fond de la barre est
      volontairement peu opaque (`bg-white/55`) : à `bg-white/75`, un survol
      `bg-white/60` ne se distinguait pas du fond et passait pour inexistant.
- [x] Quatre sections finies (modules, rôles, sécurité, appel à l'action) et
      pied de page en carte flottante. **Aucune destination inventée** : ni
      mentions légales, ni confidentialité, ni compte social n'existent —
      `LIENS_PIED` est le seul endroit à modifier le jour où ils existeront.
- [x] `/login` en deux volets à partir de `lg`, avec bascule d'affichage du mot
      de passe. Le panneau de marque est **masqué** sous `lg`, pas replié au
      -dessus : il repousserait le formulaire sous le pli.
- [x] `BarreListe` — en-tête unique de onze pages de liste, **séparée de la
      Card**.
- [x] `ScrollbarAutoHide` — scrollbar aux couleurs de la plateforme, effacée
      après 2 s d'inactivité.
- [x] `icones-navigation.ts` — table d'icônes unique.
- [x] Recherche locale sur les deux écrans de bulletins, recherche et filtre
      sur les trois listes de la console SUPER_ADMIN.

**Quatre défauts réels trouvés en chemin** :

- Le bouton blanc « Demander une démo » de la bannière finale écrivait **blanc
  sur blanc** : le variant `primary` force `!text-white` jusque sur l'enfant
  slotté. Ancres nues à la place.
- Les quatre cartes de la section « rôles » portaient la même icône `Users`, ce
  qui annulait l'idée de la section.
- Rapports, Statistiques et Journal d'audit partageaient `Presentation` :
  indistinguables sidebar repliée, où il ne reste que l'icône.
- L'invite d'installation PWA revenait après un refus de l'invite **native** :
  ce refus n'était enregistré nulle part.

**DoD** : la page d'accueil tient dans un écran à tout niveau de zoom sans bande
vide sous la capture ; les onze listes ont la même en-tête ; aucune dépendance
ajoutée au `package.json`.

---

### Fonctionnalité — Harmonisation : formulaires, tableaux, couleur d'avertissement

**Statut** : ✅ terminée et mergée sur `main` (2026-09-03) — branche
`design/verni-formulaires`, agent VERNI. Aucune migration, aucun service touché.

**Objectif** : rendre les écrans homogènes et corriger ce que l'harmonisation a
mis au jour. Les formulaires étaient corrects mais chacun reprenait les mêmes
décisions à la main, avec les dérives qui vont avec.

**Trois défauts d'accessibilité, pas de la cosmétique** :

- **Neuf champs n'étaient reliés à aucune étiquette** — six dans le bloc
  « responsables légaux » de la création d'élève, trois dans l'éditeur de lignes
  de facture : `<Label>` sans `htmlFor`, champ sans `id`. Cliquer l'étiquette ne
  faisait rien et un lecteur d'écran annonçait des champs sans nom. Il n'en
  reste aucun dans le dépôt.
- **Cinq écrans ouvraient le clavier alphanumérique** sur un champ de nombre.
  La règle existe dans `CLAUDE.md` ; elle n'était appliquée qu'à moitié.
- **« Nom complet » couvrait deux champs** distingués par leurs seuls
  marque-page, avec un `mt-1.5` posé à la main, alors que la section juste
  au-dessus sépare proprement « Nom de famille » et « Prénoms ».

**Livrables** :

- [x] `Textarea` — le composant n'existait pas : cinq écrans recopiaient la même
      chaîne de classes, et elle avait déjà divergé (`flex w-full` / `w-full`).
- [x] `Input`, `SelectTrigger` et `Textarea` au même traitement : rayon,
      bordure, **survol** et anneau de focus. Un champ inerte au survol se lit
      comme un champ désactivé.
- [x] Rayon `4px → 8px`, boutons compris — un bouton à 4px collé à un champ à
      8px se lit comme un élément étranger à la rangée.
- [x] `Card` porte `shadow-subtle` par défaut. Les `max-md:shadow-none` déjà
      présents sur les listes annulent correctement l'ombre sous `md` : ils
      avaient été écrits en prévision d'une ombre qui n'existait pas.
- [x] Token `warning` — `amber` était une couleur du système sans en être une :
      quinze fichiers, même sens, **trois opacités de fond et trois de bordure**.
      Valeurs reprises à l'identique, donc aucun changement de rendu.
- [x] `Table` prend une option `dense`, déclarée à un seul endroit par
      sélecteurs de descendants. Quatre tableaux convertis (inventaire des
      écoles, abonnements, résultats par classe, les deux de la fiche d'école) :
      la console de plateforme avait l'air d'un autre produit.
- [x] `ModaleFinEssai` montée sur le `Dialog` du projet (demande de SOKO).
- [x] Écran de souscription « paiement fermé » et écran final de `/demarrage`
      repris.

**Deux décisions** :

- `warning` n'est **pas** `error`. Une échéance qui approche, un import à
  vérifier ou une classe en surcapacité ne sont pas des fautes.
- La densité d'un tableau est une **option**, pas un second composant :
  l'en-tête, le survol et les bordures restent communs. L'annoncer sur chaque
  `TableHead` et `TableCell` aurait reproduit le problème qu'on retire.

**Hors périmètre, volontairement** : la grille d'emploi du temps et les deux
tableaux de saisie de notes restent en `<table>` brut — colonnes dynamiques,
explicitement hors motif de liste.

**DoD** : aucun `<Label>` sans `htmlFor` et aucun `type="number"` sans
`inputMode` dans le dépôt ; aucune couleur Tailwind brute hors palette ; un seul
style de tableau hors grilles de saisie.

---

### Fonctionnalité — Conseils contextuels

**Statut** : ✅ terminée et mergée sur `main` (2026-09-05) — branches
`feat/soko-conseils` puis `design/verni-conseils-mobile`. Migration `0028`.

La finition mobile de VERNI a révélé deux défauts qu'aucun test ne voyait :
la vérification de place était posée **après** `demanderConseil`, qui marque
`vuLe` et arme le délai de 24 heures — un utilisateur sur téléphone avec le
bandeau d'abonnement n'aurait vu aucun conseil de tout son essai, soit
exactement la période où ils servent. Et le garde-fou de double appel était
placé avant le `setTimeout`, laissant passer deux minuteurs.

**Objectif** : un utilisateur a accès à la plateforme sans savoir ce qu'elle
sait faire. `/demarrage` couvre la configuration initiale et s'arrête là.
Proposer, au fil de l'usage, **une chose à la fois**, choisie d'après ce qui
manque réellement en base.

**Livrables**

- [x] `src/lib/conseils/catalogue.ts` — 24 conseils, 5 familles, sans dépendance
- [x] `src/lib/conseils/choix.ts` — classement, rythme, relégation ; fonction pure
- [x] `src/services/conseils.ts` — 20 sondes, 7 gardes, diagnostic à la demande
- [x] `src/components/conseils/` — panneau flottant et Server Actions
- [x] Inventaire complet dans `/profil/aide`, groupé par famille
- [x] Migration `0028` — `conseil_utilisateur`, policy personnelle
- [x] 37 tests à l'oracle + cohérence du catalogue
- [x] Test croisant les rôles d'un conseil avec ceux de sa destination

**Décisions**

- **Par utilisateur, pas par établissement** : chacun apprend à son rythme, et
  un conseil traité par le Directeur ne doit pas disparaître chez la Secrétaire
  sans qu'elle l'ait vu.
- **L'ENSEIGNANT est inclus**, bien qu'il n'ait pas d'onboarding : c'est le rôle
  qui ignore le plus ce qu'il peut faire.
- **Aucun état terminal.** « Pas pour moi » relègue en fin de file avec un
  plancher de 30/90/180 jours. Une fermeture définitive punirait quelqu'un qui a
  seulement voulu dire « pas maintenant ».

**Pièges consignés**

- Un conseil de découverte n'a pas de sonde : rien ne le retire tant qu'il n'a
  pas été suivi. Rangé en `EXPLOITATION`, il masquait indéfiniment les conseils
  de complétion — d'où la famille `DECOUVERTE`, placée en dernier.
- Un conseil menant à un écran interdit à son rôle apprend à l'utilisateur que
  la plateforme ment. Le test croisé l'a attrapé sur `/etablissement/notes/saisie`.
- `evaluation` ne porte pas d'`etablissementId` : filtrer dessus fait échouer la
  requête au lieu de renvoyer zéro.
- `requireRole(...ROLES)` inscrit `DYNAMIQUE` dans la matrice et sort les gardes
  de l'instantané versionné.
- `listerAide` renvoyait le texte brut : `{restant}` s'affichait en toutes
  lettres sur l'inventaire. Un test le verrouille désormais pour les deux chemins.

**Reste ouvert**

- ~~**Mobile** : le panneau est desktop uniquement.~~ Fait le 2026-09-04
  (VERNI) : bannière repliable sous l'en-tête, `390x58` au repos et `390x209`
  dépliée, mesurées sur iPhone 13. Les deux présentations partagent la logique
  du même composant — deux composants séparés relanceraient chacun leur
  minuteur, et un même conseil pourrait être reporté deux fois. Fermer vaut
  « Plus tard » et jamais « Pas pour moi » : c'est le geste réflexe, il ne doit
  pas produire la sanction la plus lourde. La bannière se tait quand
  `AbonnementBanner` est présent — elle est en `fixed` sous l'en-tête et
  recouvrirait un avertissement de perte d'écriture.
- **Aucune sonde d'usage** : on mesure ce qui manque en base, pas ce que la
  personne a réellement ouvert. « Vous n'avez jamais consulté vos statistiques »
  exigerait une trace de navigation, donc une décision sur ce qu'on observe.
- Le seuil de trois refus mettant une famille en sourdine 30 jours est décrit
  mais **non implémenté** : le plancher de relégation couvre déjà le cas courant.

**DoD** : le panneau ne parle jamais deux fois en 24 h, jamais au premier écran,
et se tait entièrement sur une école entièrement configurée dont tous les
conseils de découverte ont été vus.

---

### Fonctionnalité — Modèle économique : programme fondateur

**Statut** : ✅ terminée et mergée sur `main` (2026-09-05) — branche
`feat/soko-modele-fondateur`. Migration `0030`, appliquée.

Aucun de ces écrans n'a été ouvert : le balayage par rôle reste à faire, la
machine de développement ne tenant pas un serveur Next. C'est la seule partie
de la définition de fini qui n'est pas honorée.

**Objectif** : remplacer l'acquisition par essai gratuit par un programme
commercial de lancement — une dizaine d'écoles à tarif préférentiel, accompagnées,
dont la réussite devient la preuve commerciale. Document de cadrage :
`Docs/ScolarGest_Evolution_Modele_Economique_Claude_Code.pdf`.

**Livrables**

- [x] `etablissement.regimeTarifaire` / `tarifFondateurMensuel` / `fondatriceDepuisLe`
- [x] `plan_abonnement.code` / `parCycle` / `public` / `placesMax`
- [x] Plan `FONDATEUR` : 15 000 F/mois, forfaitaire, non public, 10 places
- [x] Déclencheur `fn_limiter_ecoles_fondatrices`, vérifié en le provoquant
- [x] `definirRegimeTarifaire` (SUPER_ADMIN) et `getPlacesFondatrices` (public)
- [x] Bloc de régime sur la fiche d'établissement de la console
- [x] Troisième offre publique : « École fondatrice », prix masqué, mise en avant
- [x] Retrait des trois promesses d'essai gratuit du site public
- [x] `src/lib/fondateur.ts` sans dépendance + 8 tests

**Décisions**

- **Le prix fondateur est garanti à vie** : figé sur l'école, jamais relu dans le
  catalogue. Le nombre d'écoles étant plafonné, l'engagement est tenable.
- **Forfaitaire, contrairement à la grille standard** qui facture par cycle. Un
  complexe fondateur paie donc moins qu'un collège seul au tarif public — assumé,
  et verrouillé par un test pour que ça reste un choix constaté.
- **Le tarif commercial standard ne bouge pas** : 10 000 F/mois et 100 000 F/an
  par cycle, en attendant la première commercialisation.
- **Le montant fondateur n'est pas publié** : le publier en ferait l'ancrage
  définitif du produit. La rareté le remplace.
- **L'essai est dépromu, pas supprimé.** La mécanique reste entière et testée ;
  seule la promesse commerciale quitte le site public.

**Reste ouvert**

- **Créer une école et sa première période en un seul geste.** Commodité, pas
  correctif : j'avais annoncé qu'une école sans essai ni abonnement était bloquée,
  c'est faux — la dérogation conditionnelle du middleware laisse écrire sur
  `/demarrage`, le PIN démarre l'essai, et la dérogation se referme. École B et
  Zoka Legba sont utilisables. Reste que faire traverser à une fondatrice un essai
  qu'elle ne consommera jamais n'a pas de sens.
- **Badge « École fondatrice » côté école.** Le programme les présente comme des
  partenaires, pas des testeurs : le statut devrait se voir dans leur espace.
- **Le tarif suggéré à l'ouverture d'une période** n'est pas encore pré-rempli
  depuis le régime : le SUPER_ADMIN saisit toujours le montant à la main.
- **La collecte structurée de retours** et les témoignages (sections 3 et 8 du
  document de cadrage) n'ont aucun support produit.

**DoD** : une école admise au programme voit son tarif figé survivre à un
renouvellement, et la onzième admission est refusée par la base.

---

### Fonctionnalité — Bulletins : un seul document fait foi

**Statut** : ✅ terminée et mergée sur `main` (2026-09-05), avec
`feat/soko-conseils`. Migration `0029`, appliquée.

**Objectif** : le téléchargement groupé sortait toutes les versions du bulletin
d'un même élève, avec des noms de fichiers qui ne permettaient pas de les
départager.

**La cause n'était pas dans le téléchargement.** `regenererBulletin` marquait
bien l'ancien document `OBSOLETE`, mais la génération groupée — celle qui traite
toute une classe — n'en marquait aucun. Les bulletins s'empilaient donc tous en
`GENERE` : jusqu'à **cinq** pour un même élève sur un même trimestre, constaté en
base. Le filtre `statut === 'GENERE'`, commenté « les documents OBSOLETE sont
exclus », n'excluait rien.

**Livrables**

- [x] `genererBulletin` périme les précédents, **après** insertion du nouveau
- [x] `src/lib/bulletins.ts` — la règle « quel bulletin fait foi », partagée
- [x] Nom de fichier lisible : `KOFFI Yao - MAT-2026-0031 - Trimestre 1.pdf`
- [x] Tri alphabétique des fichiers, et `reference` comme départage à date égale
- [x] Migration `0029` — rattrapage des documents déjà empilés
- [x] 10 tests, dont l'accord entre l'écran et le téléchargement

**Pièges consignés**

- Pas d'index unique partiel : il forcerait à périmer **avant** d'insérer, et
  échangerait un défaut d'affichage contre une perte de document si le rendu PDF
  échouait.
- La lecture ne se fie pas au statut seul — les documents déjà empilés existent,
  et un correctif doit valoir sur les données d'hier.
- `document` n'a **pas** de colonne `createdAt`, contrairement à presque toutes
  les autres tables. C'est la base qui l'a dit, en refusant la migration : ni
  `tsc` ni les tests ne voient une colonne absente dans une requête PostgREST.
- Le matricule dans le nom de fichier n'est pas décoratif : deux homonymes d'une
  même classe s'écraseraient silencieusement dans le dossier choisi.

**DoD** : aucun élève n'a deux bulletins en vigueur pour une même période — 0 en
base après rattrapage.

---

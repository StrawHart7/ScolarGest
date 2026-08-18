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

### Phase 1 — Établissement, structure scolaire & utilisateurs

**Objectif** : le back-office minimal permettant à notre équipe de créer une école et au Directeur de gérer sa structure et ses utilisateurs.

**Livrables** :
- **Back-office SUPER_ADMIN** :
  - Création d'un établissement + activation des cycles (`CycleEtablissement`).
  - Création du compte Directeur (provisioning Supabase Auth → invitation email).
  - Console abonnements (lecture, validation paiements manuels).
- **Gestion années scolaires** : statuts PREPARATION / ACTIVE / TERMINEE, contrainte une seule ACTIVE par école.
- **Gestion classes** : niveau + série optionnelle (lycée) + année scolaire + capacité + tarifs par classe.
- **Gestion utilisateurs** (par le Directeur) :
  - 5 rôles fixes : SUPER_ADMIN, DIRECTEUR, SECRETAIRE, COMPTABLE, ENSEIGNANT.
  - Invitation / activation via Supabase Auth.
  - Configuration du PIN d'approbation (step-up auth) pour les rôles concernés (Secrétaire, Directeur).
- Matrice de permissions par rôle (accès lecture seule croisés selon doc 03).

**Dépend de** : Phase 0.

**DoD** : parcours complet « SUPER_ADMIN crée l'école → crée le Directeur → Directeur invite une Secrétaire → Directeur crée une année active → crée des classes avec tarifs » ; permissions vérifiées par rôle ; tests E2E du parcours.

---

### Phase 2 — Élèves, responsables légaux & inscriptions

**Objectif** : gérer la population scolaire et son inscription annuelle.

**Livrables** :
- CRUD **Élève** : matricule auto `ELV-{annee}-{seq}` par établissement et par année scolaire, `ancien_matricule`, statuts.
- **Responsables** + relation N–N `EleveResponsable` (lien de parenté, principal).
- **Inscription** : élève × année × classe, règle d'unicité (une inscription ACTIVE par élève par année), décision de fin d'année (ADMIS / REDOUBLANT / DEPART).
- **Génération automatique de la FactureEleve** à l'inscription : lignes auto depuis les `TarifScolaire` de la classe, éditables par le Comptable avant validation.
- **Passage automatique en fin d'année** : le système propose le passage des élèves admis selon `niveau_suivant_id` ; le Directeur/Secrétaire valide ou ajuste élève par élève.
- **Import Excel** élèves + responsables : upload → mapping colonnes → validation Zod → rapport d'erreurs ligne par ligne → import transactionnel.

**Dépend de** : Phase 1.

**DoD** : inscrire un nouvel élève (facture auto générée), importer une liste Excel, passer une cohorte d'une année à l'autre ; rapport d'import lisible ; tests sur les règles d'unicité et le calcul du solde facture.

---

### Phase 3 — Enseignants & affectations pédagogiques

**Objectif** : savoir qui enseigne quoi, à qui, quand.

**Livrables** :
- CRUD **Enseignant** : matricule auto `ENS-{annee}-{seq}` par établissement et par année scolaire, statuts.
  - Compte Supabase Auth **obligatoire** pour tout enseignant ACTIF — email requis à la création, invitation Supabase Auth envoyée automatiquement.
- **AffectationEnseignant** : enseignant × classe × matière × année scolaire.
  - L'affectation contrôle les droits de saisie de notes (un prof ne saisit que ses affectations).
- **TitulariteClasse** : 0 ou 1 titulaire par classe.
- Import Excel enseignants + affectations.

**Dépend de** : Phases 1–2 (peut avancer en parallèle de Phase 4 sur les matières).

**DoD** : affecter un prof polyvalent (plusieurs matières, même classe) et un prof multi-classes ; un enseignant connecté ne voit que ses classes/matières affectées ; tests de périmètre d'accès.

---

### Phase 4 — Domaine académique (le moteur)

**Objectif** : matières, coefficients, notes et calcul fiable des moyennes.

**Livrables** :
- **Matières** personnalisables par établissement + catalogue standard activable.
- **ProgrammeEtablissement** : niveau × matière, obligatoire/facultatif, ordre d'affichage.
- **CoefficientMatiere** : programme + série optionnelle + `annee_scolaire_id` (historisé dès v1).
- **Évaluations** : INTERROGATION (max 3/période), DEVOIR, COMPOSITION ; trimestres T1/T2/T3 ; contrainte d'unicité (classe + matière + type + période + numéro).
- **Notes** + **moteur de calcul** en cascade (couvert par tests unitaires avant l'UI) :
  - Moy. interros = somme / nombre saisis (si 0 interro : composante ignorée)
  - Moy. classe = (moy. interros + devoir) / 2 (si composante manquante : calcul sur ce qui existe)
  - Moy. matière = (moy. classe + composition) / 2
  - Moy. trimestrielle = Σ(moy. matière × coeff) / Σ(coefficients) — matières facultatives sans note exclues
  - Moy. annuelle = (T1 + T2 + T3) / 3
  - Arrondi : 2 décimales
- **Appréciations automatiques** (9 tranches de 0 à 20, voir doc 07).
- **Classement** par moyenne générale ET par matière.
- **Cycle de validation des notes** :
  - `BROUILLON` : saisie libre par l'Enseignant
  - `SOUMISE` : note prise en compte dans les calculs
  - `EN_ATTENTE` : modification post-soumission demandée → file d'approbation Secrétaire
  - `VALIDE` / `REJETE` : après action Secrétaire avec PIN
- **Interface d'approbation** pour la Secrétaire : modal à la connexion listant les notes `EN_ATTENTE`, actions Valider / Rejeter / Proposer une modification, saisie du PIN avant chaque action.

**Dépend de** : Phases 1–3.

**DoD** : batterie de tests unitaires sur le moteur de calcul (cas normaux + cas limites : 0 interro, matière facultative sans note, période incomplète, coeff 0) **avant** l'UI ; cycle complet saisie → soumission → demande de modification → approbation Secrétaire avec PIN → audit loggé.

---

### Phase 5 — Documents : bulletins & reçus (PDF)

**Objectif** : produire les documents officiels.

**Livrables** :
- **Bulletin** trimestriel PDF — contenu complet (doc 09) : en-tête école, en-tête élève, tableau des résultats par matière (moyennes, coefficients, rang matière, appréciation, professeur), synthèse (moyenne générale, rang, statistiques classe), zone de signature physique.
  - Même format pour tous les niveaux (maternelle, primaire, collège, lycée) — barème /20.
- **Reçu de paiement** PDF.
- Entité `Document` (référence, type, objet lié, statut GENERE / OBSOLETE / ARCHIVE) + stockage dans Supabase Storage.
- **Numérotation par établissement et par année scolaire** : `BUL-{annee}-{seq}`, `REC-{annee}-{seq}` ; l'année = année de début de l'année scolaire.
- Régénération possible d'un bulletin existant (produit le même résultat).
- Audit de génération tracé dans `AuditLog`.

**Dépend de** : Phase 4 (bulletins), Phase 2 (factures/reçus via Phase 6).

**DoD** : bulletin généré conforme au design ; régénération donne un document identique ; numérotation cohérente et séquentielle par école ; audit de génération présent.

---

### Phase 6 — Finances de l'établissement

**Objectif** : facturer les élèves et encaisser.

**Livrables** :
- **TypeFrais** : catégories de frais par établissement.
- **TarifScolaire** (par classe × TypeFrais × AnneeScolaire) — **immuable après création** ; correction = nouveau tarif.
- **FactureEleve** + **LigneFacture** — auto-générée à la validation de l'inscription ; lignes éditables par le Comptable avant validation de la facture.
- **Paiement** en plusieurs tranches : modes ESPECES / CHEQUE / VIREMENT / MOBILE_MONEY / AUTRE, calcul du solde, statuts informatifs (PAYE / PARTIEL / IMPAYE / ANNULE) — **aucun blocage système**.
- Annulation de paiement : statut `ANNULE` + nouveau paiement, jamais de suppression.
- Reçu PDF généré via Phase 5.
- Import de l'historique financier avec validation.
- Accès par rôle : COMPTABLE (lecture + écriture), DIRECTEUR (lecture), SECRETAIRE (lecture seule), ENSEIGNANT (aucun accès).

**Dépend de** : Phases 1–2.

**DoD** : inscrire un élève → facture auto générée → Comptable ajuste une ligne → enregistrer 3 paiements partiels → générer reçu → annuler un paiement (mouvement inverse tracé) ; jamais de suppression dans `AuditLog`.

---

### Phase 7 — Abonnement SaaS (côté plateforme)

**Objectif** : gérer la relation commerciale plateforme ↔ écoles.

**Livrables** :
- **PlanAbonnement** (mensuel / annuel), **AbonnementEtablissement**, **PaiementAbonnement** — strictement séparés des finances école.
- Statuts : ACTIF / EXPIRE / SUSPENDU — **pas de statut ESSAI** (entrée uniquement par demande de démo validée par SUPER_ADMIN).
- **Console SUPER_ADMIN** :
  - Suivi des abonnements par école.
  - Validation manuelle d'un paiement (virement / Mobile Money) → passage de l'abonnement à ACTIF.
  - Suspension manuelle.
- Comportement à l'expiration : à définir lors de l'implémentation (bandeau d'avertissement → blocage progressif).

**Dépend de** : Phase 1.

**DoD** : cycle « SUPER_ADMIN crée école → abonnement ACTIF → SUPER_ADMIN valide paiement manuel → renouvellement → expiration → suspension » ; séparation financière stricte vérifiée.

---

### Phase 8 — Dashboard, rapports & exports

**Objectif** : transformer les données en pilotage.

**Livrables** :
- **Dashboard par rôle** :
  - DIRECTEUR : vue globale (élèves, classes, finance, académique) + flux d'activité (bulletins générés, paiements, inscriptions, modifications de notes — informatif uniquement).
  - COMPTABLE : état financier (revenus attendus, encaissés, impayés).
  - SECRETAIRE : inscriptions, bulletins à générer.
  - ENSEIGNANT : ses classes, ses évaluations.
- **Rapports** : liste élèves, liste enseignants, effectifs, état paiements, résultats par classe.
- **Exports** Excel/CSV/PDF avec périmètre par rôle (voir doc 09, section 9).

**Dépend de** : Phases 2–7.

**DoD** : chaque rôle voit uniquement son périmètre ; chiffres du dashboard réconciliés avec les données sources ; exports testés avec des données réelles.

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

Phases 2–7 ──► Phase 8 ──► Phase 9
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

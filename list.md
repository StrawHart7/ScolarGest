# LIST.md — ScoolAdmin : tout ce dont on a besoin

> Liste exhaustive par catégorie. À cocher au fur et à mesure.
> Référence : `PLAN.md` (phases), `Docs/` (spécifications), `DESIGN.md` (design system).

---

## 1. Comptes & services à créer

### Hébergement & infrastructure
- [ ] Compte **GitHub** — repo privé `scooladmin`
- [ ] Compte **Vercel** — hébergement Next.js (lié au repo GitHub)
- [ ] Compte **Supabase** — projet `scooladmin-prod` (PostgreSQL + Auth + Storage)
- [ ] Projet Supabase **staging** séparé — `scooladmin-staging`

### Email transactionnel
- [ ] Compte **Resend** (ou configurer SMTP Supabase) — pour les emails d'invitation, récupération de mot de passe
- [ ] Domaine email expéditeur vérifié — ex. `noreply@scooladmin.app`

### Domaine
- [ ] Nom de domaine acheté — ex. `scooladmin.app`
- [ ] DNS configuré vers Vercel
- [ ] SSL/TLS activé (Vercel le gère automatiquement)

### Monitoring & erreurs
- [ ] Compte **Sentry** — suivi des erreurs en production (Next.js + Supabase)

### Stockage PDF
- [ ] Bucket Supabase Storage `documents` configuré (accès privé — URLs signées)
- [ ] Politique d'accès au bucket (lecture restreinte par `etablissement_id`)

---

## 2. Variables d'environnement

### Next.js / Vercel
- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` — pour les appels admin (invitations, provisioning)
- [ ] `DATABASE_URL` — URL Postgres directe pour Prisma (mode `direct`)
- [ ] `DIRECT_URL` — URL Postgres pour les migrations Prisma
- [ ] `NEXT_PUBLIC_APP_URL` — URL de l'app (ex. `https://scooladmin.app`)
- [ ] `SENTRY_DSN`
- [ ] `SENTRY_AUTH_TOKEN` — pour les source maps
- [ ] `RESEND_API_KEY` (si Resend pour les emails)

### Supabase Auth Hooks
- [ ] Hook configuré sur `auth.users` → injecte `etablissement_id` + `role` dans `app_metadata` du JWT

---

## 3. Configuration Supabase

- [ ] Auth : email/password activé
- [ ] Auth : magic link désactivé (pas prévu)
- [ ] Auth : confirmation d'email activée pour les invitations
- [ ] Auth : URL de redirection configurée (`/auth/callback`)
- [ ] Auth : templates email personnalisés (invitation, reset password) — en français
- [ ] Auth Hook : fonction PostgreSQL ou Edge Function injectant les custom claims JWT
- [ ] Storage : bucket `documents` créé (privé)
- [ ] Storage : policies configurées par `etablissement_id`
- [ ] RLS : désactivé sur les tables métier (isolation applicative via Prisma)
- [ ] Extensions PostgreSQL : `uuid-ossp` activée

---

## 4. Configuration Prisma & base de données

### Schéma — toutes les tables à créer
- [ ] `Utilisateur` (id = auth.users.id, etablissement_id, role, statut, pin_approbation_hash)
- [ ] `Etablissement` (nom, sigle, logo, adresse, ville, telephone, email, statut)
- [ ] `Cycle` (nom, ordre) — catalogue système
- [ ] `CycleEtablissement` (etablissement_id, cycle_id, actif)
- [ ] `Niveau` (cycle_id, nom, ordre, niveau_suivant_id) — catalogue système
- [ ] `Serie` (nom, cycle_id) — catalogue système
- [ ] `AnneeScolaire` (etablissement_id, libelle, date_debut, date_fin, statut)
- [ ] `Classe` (etablissement_id, annee_scolaire_id, niveau_id, serie_id, nom, capacite)
- [ ] `Eleve` (etablissement_id, matricule, nom, prenoms, sexe, date_naissance, lieu_naissance, nationalite, photo, statut, ancien_matricule)
- [ ] `Responsable` (etablissement_id, nom, prenoms, telephone, email, adresse, profession, type)
- [ ] `EleveResponsable` (eleve_id, responsable_id, lien_parente, principal)
- [ ] `Inscription` (etablissement_id, eleve_id, annee_scolaire_id, classe_id, date_inscription, statut, decision_fin_annee)
- [ ] `Enseignant` (etablissement_id, utilisateur_id, matricule, nom, prenoms, sexe, date_naissance, telephone, email, adresse, date_embauche, statut, ancien_matricule)
- [ ] `AffectationEnseignant` (etablissement_id, annee_scolaire_id, enseignant_id, classe_id, matiere_id)
- [ ] `TitulariteClasse` (annee_scolaire_id, classe_id, enseignant_id)
- [ ] `Matiere` (etablissement_id, nom, code, description, statut)
- [ ] `ProgrammeEtablissement` (etablissement_id, niveau_id, matiere_id, obligatoire, ordre_affichage)
- [ ] `CoefficientMatiere` (programme_etablissement_id, annee_scolaire_id, serie_id, coefficient)
- [ ] `Evaluation` (annee_scolaire_id, classe_id, matiere_id, type, periode, numero, date)
- [ ] `Note` (evaluation_id, eleve_id, valeur, observation, statut)
- [ ] `TypeFrais` (etablissement_id, nom, description, statut)
- [ ] `TarifScolaire` (etablissement_id, annee_scolaire_id, classe_id, type_frais_id, montant)
- [ ] `FactureEleve` (etablissement_id, eleve_id, annee_scolaire_id, montant_total, statut, date_creation)
- [ ] `LigneFacture` (facture_id, type_frais_id, designation, montant)
- [ ] `Paiement` (facture_id, montant, date_paiement, mode_paiement, reference, statut)
- [ ] `Document` (etablissement_id, type, reference, chemin_fichier, objet_type, objet_id, date_generation, created_by, statut)
- [ ] `PlanAbonnement` (nom, duree, prix, fonctionnalites)
- [ ] `AbonnementEtablissement` (etablissement_id, plan_id, date_debut, date_fin, statut)
- [ ] `PaiementAbonnement` (abonnement_id, montant, date, mode_paiement, reference)
- [ ] `AuditLog` (etablissement_id, user_id, action, module, objet_type, objet_id, ancienne_valeur, nouvelle_valeur, date)

### Enums Prisma
- [ ] `Role` : SUPER_ADMIN, DIRECTEUR, SECRETAIRE, COMPTABLE, ENSEIGNANT
- [ ] `StatutUtilisateur` : ACTIF, INACTIF, BLOQUE
- [ ] `StatutEleve` : ACTIF, INACTIF, ARCHIVE, TRANSFERE
- [ ] `StatutEnseignant` : ACTIF, INACTIF, CONGE, DEPART
- [ ] `StatutInscription` : ACTIVE, TERMINEE, ANNULEE, ABANDON
- [ ] `DecisionFinAnnee` : ADMIS, REDOUBLANT, DEPART
- [ ] `StatutAnneeScolaire` : PREPARATION, ACTIVE, TERMINEE
- [ ] `TypeEvaluation` : INTERROGATION, DEVOIR, COMPOSITION
- [ ] `Periode` : TRIMESTRE_1, TRIMESTRE_2, TRIMESTRE_3
- [ ] `StatutNote` : BROUILLON, SOUMISE, EN_ATTENTE, VALIDE, REJETE
- [ ] `StatutFacture` : PAYE, PARTIEL, IMPAYE, ANNULE
- [ ] `StatutPaiement` : PAYE, PARTIEL, IMPAYE, ANNULE
- [ ] `ModePaiement` : ESPECES, CHEQUE, VIREMENT, MOBILE_MONEY, AUTRE
- [ ] `StatutAbonnement` : ACTIF, EXPIRE, SUSPENDU
- [ ] `TypeDocument` : BULLETIN, RECU, RAPPORT
- [ ] `StatutDocument` : GENERE, OBSOLETE, ARCHIVE
- [ ] `TypeResponsable` : PERE, MERE, TUTEUR, AUTRE

### Seeds (données initiales)
- [ ] Cycles : COLLEGE, LYCEE (maternelle et primaire retires du catalogue, migration 0014)
- [ ] Niveaux par cycle avec `niveau_suivant_id` (séquence complète Togo)
- [ ] Séries lycée : A4, C, D, F4, G2, G3 (et autres séries togolaises)
- [ ] Plans d'abonnement : Mensuel, Annuel
- [ ] Compte SUPER_ADMIN initial

---

## 5. Infrastructure technique (Phase 0)

- [x] Repo GitHub initialisé avec `.gitignore`, `README.md`
- [x] Next.js 14+ App Router initialisé (TypeScript strict)
- [x] ESLint + Prettier configurés
- [x] Tailwind CSS configuré avec les tokens `DESIGN.md` (couleurs, typographie, espacement)
- [x] shadcn/ui initialisé avec le thème Luminous Institutional
- [x] Accès données via `@supabase/supabase-js`/`@supabase/ssr` (pas d'ORM Prisma — décision révisée, voir `CLAUDE.md`)
- [x] `@supabase/ssr` configuré (middleware, client serveur, client client)
- [x] Vitest configuré (tests unitaires)
- [x] Playwright configuré (tests E2E + génération PDF)
- [ ] CI GitHub Actions : lint + typecheck + tests unitaires à chaque push
- [ ] Déploiement automatique Vercel sur `main`
- [ ] Preview deployments sur PRs

---

## 6. Design system — composants de base

### Tokens à implémenter (depuis `DESIGN.md`)
- [x] Palette de couleurs Luminous Institutional dans `tailwind.config.ts`
- [x] Typographie (famille, tailles, poids)
- [x] Espacement et border-radius personnalisés
- [ ] Ombres et élévations

### Composants shadcn/ui à configurer
- [x] Button (variantes : primary, secondary, ghost, destructive)
- [x] Input
- [ ] Textarea
- [ ] Select
- [ ] Checkbox
- [x] Badge
- [x] Card
- [ ] Table (avec tri et pagination)
- [ ] Dialog / Modal
- [ ] Drawer (mobile)
- [ ] Tabs
- [ ] Alert / Toast (notifications)
- [ ] Form (avec react-hook-form)
- [ ] Skeleton (chargement)
- [ ] Avatar
- [ ] Dropdown Menu
- [ ] Separator
- [ ] Breadcrumb
- [ ] Progress

### Composants applicatifs partagés
- [x] `AppLayout` — sidebar 260px + header 56px + zone contenu
- [x] `Sidebar` — navigation par rôle (items différents selon le rôle)
- [ ] `Header` — nom école, rôle utilisateur, menu profil
- [ ] `PageHeader` — titre de page + actions principales
- [ ] `DataTable` — tableau avec tri, filtre, pagination, export
- [ ] `StatCard` — carte de statistique (dashboard)
- [ ] `EmptyState` — état vide illustré
- [ ] `ConfirmDialog` — confirmation avant action destructive
- [ ] `PinModal` — saisie du PIN step-up (modal sécurisé)
- [ ] `StatusBadge` — badge coloré selon le statut
- [ ] `RoleBadge` — badge par rôle utilisateur
- [ ] `FileUpload` — upload Excel avec drag-and-drop
- [ ] `ImportReport` — rapport d'erreurs d'import ligne par ligne
- [ ] `AuditTimeline` — affichage des logs d'audit

---

## 7. Maquettes — pages par rôle

### Authentification (tous rôles)
- [x] `/login` — connexion email + mot de passe (+ Google OAuth)
- [x] `/forgot-password` — demande de réinitialisation
- [x] `/update-password` — définir un nouveau mot de passe (depuis email)
- [ ] `/auth/accept-invite` — accepter une invitation + définir mot de passe + configurer PIN (si rôle approbateur)
- [x] `/auth/callback` — callback Supabase Auth (redirect silencieux)

---

### SUPER_ADMIN

- [ ] `/super-admin` — dashboard : nb d'écoles, abonnements actifs/expirés, dernières activités
- [ ] `/super-admin/etablissements` — liste des établissements (statut abonnement, date création)
- [ ] `/super-admin/etablissements/nouveau` — créer un établissement + créer le compte Directeur
- [ ] `/super-admin/etablissements/[id]` — détail école : info, abonnement, utilisateurs, statut
- [ ] `/super-admin/etablissements/[id]/abonnement` — gérer l'abonnement (valider paiement, changer plan, suspendre)
- [ ] `/super-admin/abonnements` — liste globale de tous les abonnements
- [ ] `/super-admin/paiements` — liste des paiements d'abonnement à valider (en attente)

---

### DIRECTEUR

- [ ] `/dashboard` — flux d'activité (bulletins générés, inscriptions, paiements, notes modifiées), statistiques globales de l'école
- [ ] `/etablissement/parametres` — infos école (nom, logo, adresse, contacts)
- [ ] `/etablissement/annees-scolaires` — liste des années scolaires
- [ ] `/etablissement/annees-scolaires/nouvelle` — créer une année scolaire
- [ ] `/etablissement/annees-scolaires/[id]` — détail + clôture d'année (passage automatique)
- [ ] `/etablissement/cycles` — activer/désactiver les cycles de l'école
- [ ] `/etablissement/classes` — liste des classes de l'année active
- [ ] `/etablissement/classes/nouvelle` — créer une classe (niveau, série, capacité, tarifs)
- [ ] `/etablissement/classes/[id]` — détail classe (élèves inscrits, enseignants affectés, tarifs)
- [ ] `/utilisateurs` — liste des utilisateurs de l'école (tous rôles sauf SUPER_ADMIN)
- [ ] `/utilisateurs/inviter` — inviter un nouvel utilisateur (email + rôle)
- [ ] `/utilisateurs/[id]` — détail utilisateur (statut, rôle, dernier accès, désactiver)

---

### SECRÉTAIRE

- [ ] `/dashboard` — inscriptions récentes, bulletins à générer, notes en attente d'approbation (badge)
- [ ] `/eleves` — liste des élèves (filtres : classe, statut, recherche)
- [ ] `/eleves/nouveau` — créer un élève + responsables + inscription + génération facture
- [ ] `/eleves/import` — import Excel élèves (upload → mapping → validation → rapport → import)
- [ ] `/eleves/[id]` — fiche élève complète (infos, responsables, historique inscriptions, bulletins)
- [ ] `/eleves/[id]/modifier` — modifier les infos d'un élève
- [ ] `/eleves/[id]/responsables` — gérer les responsables (ajouter, modifier, définir principal)
- [ ] `/eleves/[id]/inscription` — modifier l'inscription (classe, statut)
- [ ] `/inscriptions` — liste de toutes les inscriptions de l'année active
- [ ] `/inscriptions/passage` — outil de passage de classe en fin d'année (tableau élèves → décision par décision)
- [ ] `/bulletins` — liste des bulletins générés (par classe, par trimestre)
- [ ] `/bulletins/generer` — sélectionner classe + trimestre → générer bulletins en masse
- [ ] `/bulletins/[id]` — aperçu d'un bulletin + bouton télécharger PDF
- [ ] `/approbations` — file d'approbation des notes en attente (avec saisie PIN avant action)

---

### COMPTABLE

- [ ] `/dashboard` — revenus attendus vs encaissés, impayés, paiements récents
- [ ] `/tarifs` — liste des TypeFrais + TarifScolaire par classe et par année
- [ ] `/tarifs/nouveau` — créer un type de frais + saisir les tarifs par classe
- [ ] `/factures` — liste des factures (filtres : élève, classe, statut paiement)
- [ ] `/factures/[id]` — détail facture (lignes, paiements reçus, solde, historique)
- [ ] `/factures/[id]/paiement` — enregistrer un paiement (montant, mode, référence)
- [ ] `/factures/[id]/recu` — aperçu du reçu PDF + téléchargement
- [ ] `/rapports/financier` — rapport financier (recettes par période, impayés, par classe)
- [ ] `/rapports/export` — exporter les données financières (Excel / CSV / PDF)

---

### ENSEIGNANT

- [ ] `/dashboard` — mes classes, évaluations récentes, notes à saisir
- [ ] `/mes-classes` — liste des classes affectées (avec matières)
- [ ] `/mes-classes/[classeId]/[matiereId]` — vue matière dans une classe : évaluations + saisie notes
- [ ] `/mes-classes/[classeId]/[matiereId]/evaluation/nouvelle` — créer une évaluation (type, période, date)
- [ ] `/mes-classes/[classeId]/[matiereId]/evaluation/[id]` — saisie des notes de l'évaluation (tableau élèves)
- [ ] `/mes-classes/[classeId]/resultats` — résultats de la classe (moyennes par matière, classement)

---

### Pages communes (tous rôles authentifiés)
- [ ] `/profil` — infos personnelles, changer le PIN d'approbation
- [ ] `/404` — page non trouvée
- [ ] `/403` — accès refusé (mauvais rôle)
- [ ] `/500` — erreur serveur

---

## 8. Templates PDF (Playwright)

- [ ] **Bulletin trimestriel** — en-tête école, en-tête élève, tableau matières (moyennes, coeff, rang, appréciation, prof), synthèse (moy. générale, rang, stats classe), zone de signature physique
- [ ] **Reçu de paiement** — logo école, infos élève + responsable, montant, date, mode, référence, numéro reçu (format REC-AAAA-XXXXXX)
- [ ] **Rapport financier** (optionnel PDF) — tableau récapitulatif des paiements

---

## 9. Logique métier — services à implémenter et tester

### Moteur de calcul académique (Vitest — avant toute UI)
- [ ] Calcul moyenne des interrogations (0, 1, 2 ou 3 interros)
- [ ] Calcul moyenne de classe `(moy_interros + devoir) / 2` avec composante manquante
- [ ] Calcul moyenne matière `(moy_classe + composition) / 2`
- [ ] Calcul moyenne trimestrielle pondérée (avec matières facultatives sans note)
- [ ] Calcul moyenne annuelle `(T1 + T2 + T3) / 3`
- [ ] Arrondi à 2 décimales
- [ ] Attribution appréciation automatique (9 tranches)
- [ ] Calcul classement par matière
- [ ] Calcul classement général

### Services critiques
- [x] `getTenantContext()` — extrait `etablissement_id` + `role` du JWT Supabase
- [x] `auditLog()` — helper d'audit réutilisable
- [x] `generateMatriculeEleve()` — séquence par établissement + année scolaire
- [x] `generateMatriculeEnseignant()` — séquence par établissement + année scolaire
- [x] `generateNumeroDocument()` — séquence par établissement + année scolaire + type
- [x] `verifyPin()` — vérification du PIN step-up (hash bcrypt)
- [ ] `generateFactureFromInscription()` — auto-génère les lignes de facture depuis les tarifs de la classe
- [ ] `proposePassageAutomatique()` — génère les propositions de passage via `niveau_suivant_id`
- [ ] `generateBulletinPDF()` — Playwright server-side

---

## 10. Tests

### Tests unitaires (Vitest)
- [ ] Moteur de calcul académique — tous les cas limites
- [ ] Calcul du solde facture
- [ ] Génération des matricules (unicité, format)
- [ ] Génération des numéros de documents
- [ ] Attribution des appréciations
- [ ] Logique de classement

### Tests E2E (Playwright)
- [ ] Parcours login / logout
- [ ] SUPER_ADMIN : créer une école + Directeur
- [ ] Directeur : créer année scolaire + classes + inviter Secrétaire
- [ ] Secrétaire : inscrire un élève + vérifier facture générée
- [ ] Secrétaire : importer un fichier Excel élèves
- [ ] Enseignant : saisir des notes → soumettre → demander modification
- [ ] Secrétaire : approuver une note (saisir PIN → valider)
- [ ] Secrétaire : générer un bulletin PDF
- [ ] Comptable : enregistrer un paiement → générer un reçu
- [ ] Test isolation tenant : tentative d'accès croisé entre deux écoles → 403

---

## 11. Sécurité

- [ ] Middleware Next.js : vérification session Supabase à chaque requête protégée
- [ ] Guard tenant : tout repository injecte `etablissement_id` (aucune exception)
- [ ] Vérification de rôle sur chaque Server Action / Route Handler
- [ ] Validation Zod sur toutes les entrées utilisateur (y compris imports Excel)
- [ ] Rate limiting sur les routes d'auth (Supabase le gère partiellement)
- [ ] Uploads : validation type MIME + taille max (Excel uniquement pour les imports)
- [ ] URLs signées pour les PDFs (accès temporaire Supabase Storage)
- [ ] PIN step-up hashé bcrypt + validation côté serveur uniquement

---

## 12. Onboarding d'une école (checklist opérationnelle)

Checklist que le SUPER_ADMIN suit pour configurer une nouvelle école :

- [ ] Créer l'établissement (nom, logo, contacts)
- [ ] Activer les cycles correspondants
- [ ] Créer la première année scolaire (statut PREPARATION)
- [ ] Créer les classes avec leurs tarifs
- [ ] Configurer les matières + ProgrammeEtablissement + coefficients
- [ ] Créer le compte Directeur (invitation Supabase Auth)
- [ ] Le Directeur invite Secrétaire, Comptable, Enseignants
- [ ] Importer les élèves (Excel)
- [ ] Importer les enseignants + affecter aux classes/matières
- [ ] Passer l'année scolaire en statut ACTIF
- [ ] Configurer l'abonnement + valider le premier paiement

---

## 13. Livrables documentaires

- [ ] `CLAUDE.md` — instructions pour Claude Code ✅
- [ ] `PLAN.md` — feuille de route par phases ✅
- [ ] `analysis.md` — décisions de conception (Q0–Q17) ✅
- [ ] `list.md` — cette liste ✅
- [ ] `Docs/01` à `Docs/10` — spécifications métier ✅
- [ ] `DESIGN.md` — design system Luminous Institutional ✅
- [x] `README.md` — setup local, commandes, architecture
- [x] Schéma SQL Supabase commenté (`supabase/migrations/0001_init.sql`)
- [ ] Runbook de support — à créer en Phase 9
- [ ] Procédure de déploiement — à créer en Phase 9

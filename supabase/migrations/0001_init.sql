-- ScoolAdmin — initial schema (Phase 0)
-- Source of truth: Docs/10 (ERD) + list.md §4.
-- Multi-tenant: every business table carries etablissement_id, isolation via RLS.
-- No hard deletes for financial, grade, invoice, enrollment data — use statut fields.

-- ============================================================
-- Extensions
-- ============================================================
create extension if not exists "pgcrypto";

-- ============================================================
-- Enums
-- ============================================================
create type role as enum ('SUPER_ADMIN', 'DIRECTEUR', 'SECRETAIRE', 'COMPTABLE', 'ENSEIGNANT');
create type statut_utilisateur as enum ('ACTIF', 'INACTIF', 'BLOQUE');
create type statut_etablissement as enum ('ACTIF', 'INACTIF', 'SUSPENDU');
create type statut_eleve as enum ('ACTIF', 'INACTIF', 'ARCHIVE', 'TRANSFERE');
create type statut_enseignant as enum ('ACTIF', 'INACTIF', 'CONGE', 'DEPART');
create type statut_inscription as enum ('ACTIVE', 'TERMINEE', 'ANNULEE', 'ABANDON');
create type decision_fin_annee as enum ('ADMIS', 'REDOUBLANT', 'DEPART');
create type statut_annee_scolaire as enum ('PREPARATION', 'ACTIVE', 'TERMINEE');
create type type_evaluation as enum ('INTERROGATION', 'DEVOIR', 'COMPOSITION');
create type periode as enum ('TRIMESTRE_1', 'TRIMESTRE_2', 'TRIMESTRE_3');
create type statut_note as enum ('BROUILLON', 'SOUMISE', 'EN_ATTENTE', 'VALIDE', 'REJETE');
create type statut_facture as enum ('PAYE', 'PARTIEL', 'IMPAYE', 'ANNULE');
create type statut_paiement as enum ('PAYE', 'PARTIEL', 'IMPAYE', 'ANNULE');
create type mode_paiement as enum ('ESPECES', 'CHEQUE', 'VIREMENT', 'MOBILE_MONEY', 'AUTRE');
create type statut_abonnement as enum ('ACTIF', 'EXPIRE', 'SUSPENDU');
create type type_document as enum ('BULLETIN', 'RECU', 'RAPPORT');
create type statut_document as enum ('GENERE', 'OBSOLETE', 'ARCHIVE');
create type type_responsable as enum ('PERE', 'MERE', 'TUTEUR', 'AUTRE');
create type sexe as enum ('M', 'F');
create type statut_matiere as enum ('ACTIF', 'INACTIF');
create type statut_type_frais as enum ('ACTIF', 'INACTIF');

-- ============================================================
-- JWT helpers — reads custom claims injected via Supabase Auth Hook
-- (app_metadata.etablissement_id, app_metadata.role)
-- ============================================================
create or replace function auth_etablissement_id() returns uuid
language sql stable as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'etablissement_id', '')::uuid;
$$;

create or replace function auth_role() returns text
language sql stable as $$
  select auth.jwt() -> 'app_metadata' ->> 'role';
$$;

create or replace function is_super_admin() returns boolean
language sql stable as $$
  select auth_role() = 'SUPER_ADMIN';
$$;

create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new."updatedAt" = now();
  return new;
end;
$$;

-- ============================================================
-- Etablissement & identité
-- ============================================================
create table etablissement (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  sigle text,
  logo text,
  adresse text,
  ville text,
  telephone text,
  email text,
  statut statut_etablissement not null default 'ACTIF',
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
create trigger trg_etablissement_updated before update on etablissement
  for each row execute function touch_updated_at();

-- id = auth.users.id (Supabase Auth)
create table utilisateur (
  id uuid primary key,
  "etablissementId" uuid references etablissement(id),
  nom text not null,
  prenom text not null,
  email text not null unique,
  telephone text,
  role role not null,
  statut statut_utilisateur not null default 'ACTIF',
  "pinApprobationHash" text,
  "dernierAcces" timestamptz,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
create index idx_utilisateur_etablissement on utilisateur("etablissementId");
create index idx_utilisateur_role on utilisateur(role);
create trigger trg_utilisateur_updated before update on utilisateur
  for each row execute function touch_updated_at();

-- ============================================================
-- Structure scolaire (catalogues + par école)
-- ============================================================
create table cycle (
  id uuid primary key default gen_random_uuid(),
  nom text not null unique,
  ordre int not null unique
);

create table cycle_etablissement (
  id uuid primary key default gen_random_uuid(),
  "etablissementId" uuid not null references etablissement(id),
  "cycleId" uuid not null references cycle(id),
  actif boolean not null default true,
  unique ("etablissementId", "cycleId")
);
create index idx_cycle_etablissement_etab on cycle_etablissement("etablissementId");

create table niveau (
  id uuid primary key default gen_random_uuid(),
  "cycleId" uuid not null references cycle(id),
  nom text not null,
  ordre int not null,
  "niveauSuivantId" uuid unique references niveau(id),
  unique ("cycleId", nom)
);
create index idx_niveau_cycle on niveau("cycleId");

create table serie (
  id uuid primary key default gen_random_uuid(),
  "cycleId" uuid not null references cycle(id),
  nom text not null,
  unique ("cycleId", nom)
);

create table annee_scolaire (
  id uuid primary key default gen_random_uuid(),
  "etablissementId" uuid not null references etablissement(id),
  libelle text not null,
  "dateDebut" timestamptz not null,
  "dateFin" timestamptz not null,
  statut statut_annee_scolaire not null default 'PREPARATION',
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique ("etablissementId", libelle)
);
create index idx_annee_scolaire_etab on annee_scolaire("etablissementId");
create index idx_annee_scolaire_etab_statut on annee_scolaire("etablissementId", statut);
-- One ACTIVE annee scolaire per etablissement.
create unique index uniq_annee_scolaire_active on annee_scolaire("etablissementId") where statut = 'ACTIVE';
create trigger trg_annee_scolaire_updated before update on annee_scolaire
  for each row execute function touch_updated_at();

create table classe (
  id uuid primary key default gen_random_uuid(),
  "etablissementId" uuid not null references etablissement(id),
  "anneeScolaireId" uuid not null references annee_scolaire(id),
  "niveauId" uuid not null references niveau(id),
  "serieId" uuid references serie(id),
  nom text not null,
  capacite int,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique ("etablissementId", "anneeScolaireId", nom)
);
create index idx_classe_etab on classe("etablissementId");
create index idx_classe_annee on classe("anneeScolaireId");
create trigger trg_classe_updated before update on classe
  for each row execute function touch_updated_at();

-- ============================================================
-- Élèves & responsables
-- ============================================================
create table eleve (
  id uuid primary key default gen_random_uuid(),
  "etablissementId" uuid not null references etablissement(id),
  matricule text not null,
  "ancienMatricule" text,
  nom text not null,
  prenoms text not null,
  sexe sexe not null,
  "dateNaissance" timestamptz not null,
  "lieuNaissance" text,
  nationalite text,
  photo text,
  statut statut_eleve not null default 'ACTIF',
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique ("etablissementId", matricule)
);
create index idx_eleve_etab on eleve("etablissementId");
create index idx_eleve_etab_nom on eleve("etablissementId", nom, prenoms);
create trigger trg_eleve_updated before update on eleve
  for each row execute function touch_updated_at();

create table responsable (
  id uuid primary key default gen_random_uuid(),
  "etablissementId" uuid not null references etablissement(id),
  nom text not null,
  prenoms text not null,
  telephone text,
  email text,
  adresse text,
  profession text,
  type type_responsable not null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
create index idx_responsable_etab on responsable("etablissementId");
create trigger trg_responsable_updated before update on responsable
  for each row execute function touch_updated_at();

create table eleve_responsable (
  id uuid primary key default gen_random_uuid(),
  "eleveId" uuid not null references eleve(id),
  "responsableId" uuid not null references responsable(id),
  "lienParente" text not null,
  principal boolean not null default false,
  unique ("eleveId", "responsableId")
);
create index idx_eleve_responsable_eleve on eleve_responsable("eleveId");

create table inscription (
  id uuid primary key default gen_random_uuid(),
  "etablissementId" uuid not null references etablissement(id),
  "eleveId" uuid not null references eleve(id),
  "anneeScolaireId" uuid not null references annee_scolaire(id),
  "classeId" uuid not null references classe(id),
  "dateInscription" timestamptz not null default now(),
  statut statut_inscription not null default 'ACTIVE',
  "decisionFinAnnee" decision_fin_annee,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique ("eleveId", "anneeScolaireId")
);
create index idx_inscription_etab on inscription("etablissementId");
create index idx_inscription_annee_classe on inscription("anneeScolaireId", "classeId");
create trigger trg_inscription_updated before update on inscription
  for each row execute function touch_updated_at();

-- ============================================================
-- Enseignants
-- ============================================================
create table enseignant (
  id uuid primary key default gen_random_uuid(),
  "etablissementId" uuid not null references etablissement(id),
  "utilisateurId" uuid unique references utilisateur(id),
  matricule text not null,
  "ancienMatricule" text,
  nom text not null,
  prenoms text not null,
  sexe sexe not null,
  "dateNaissance" timestamptz,
  telephone text,
  email text,
  adresse text,
  "dateEmbauche" timestamptz,
  statut statut_enseignant not null default 'ACTIF',
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique ("etablissementId", matricule)
);
create index idx_enseignant_etab on enseignant("etablissementId");
create trigger trg_enseignant_updated before update on enseignant
  for each row execute function touch_updated_at();

create table affectation_enseignant (
  id uuid primary key default gen_random_uuid(),
  "etablissementId" uuid not null references etablissement(id),
  "anneeScolaireId" uuid not null references annee_scolaire(id),
  "enseignantId" uuid not null references enseignant(id),
  "classeId" uuid not null references classe(id),
  "matiereId" uuid not null,
  "createdAt" timestamptz not null default now(),
  unique ("anneeScolaireId", "enseignantId", "classeId", "matiereId")
);
create index idx_affectation_etab on affectation_enseignant("etablissementId");
create index idx_affectation_annee_classe_matiere on affectation_enseignant("anneeScolaireId", "classeId", "matiereId");

create table titularite_classe (
  id uuid primary key default gen_random_uuid(),
  "anneeScolaireId" uuid not null references annee_scolaire(id),
  "classeId" uuid not null unique references classe(id),
  "enseignantId" uuid not null references enseignant(id)
);
create index idx_titularite_annee on titularite_classe("anneeScolaireId");

-- ============================================================
-- Académique
-- ============================================================
create table matiere (
  id uuid primary key default gen_random_uuid(),
  "etablissementId" uuid not null references etablissement(id),
  nom text not null,
  code text,
  description text,
  statut statut_matiere not null default 'ACTIF',
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique ("etablissementId", nom)
);
create index idx_matiere_etab on matiere("etablissementId");
create trigger trg_matiere_updated before update on matiere
  for each row execute function touch_updated_at();

-- affectation_enseignant references matiere — add FK now that matiere exists.
alter table affectation_enseignant
  add constraint fk_affectation_matiere foreign key ("matiereId") references matiere(id);

create table programme_etablissement (
  id uuid primary key default gen_random_uuid(),
  "etablissementId" uuid not null references etablissement(id),
  "niveauId" uuid not null references niveau(id),
  "matiereId" uuid not null references matiere(id),
  obligatoire boolean not null default true,
  "ordreAffichage" int not null default 0,
  unique ("etablissementId", "niveauId", "matiereId")
);
create index idx_programme_etab on programme_etablissement("etablissementId");

create table coefficient_matiere (
  id uuid primary key default gen_random_uuid(),
  "programmeEtablissementId" uuid not null references programme_etablissement(id),
  "anneeScolaireId" uuid not null references annee_scolaire(id),
  "serieId" uuid references serie(id),
  coefficient float8 not null,
  unique ("programmeEtablissementId", "anneeScolaireId", "serieId")
);
create index idx_coefficient_annee on coefficient_matiere("anneeScolaireId");

create table evaluation (
  id uuid primary key default gen_random_uuid(),
  "anneeScolaireId" uuid not null references annee_scolaire(id),
  "classeId" uuid not null references classe(id),
  "matiereId" uuid not null references matiere(id),
  type type_evaluation not null,
  periode periode not null,
  numero int not null default 1,
  date timestamptz not null,
  "createdAt" timestamptz not null default now(),
  unique ("classeId", "matiereId", type, periode, numero)
);
create index idx_evaluation_annee_classe on evaluation("anneeScolaireId", "classeId");

create table note (
  id uuid primary key default gen_random_uuid(),
  "evaluationId" uuid not null references evaluation(id),
  "eleveId" uuid not null references eleve(id),
  valeur float8,
  observation text,
  statut statut_note not null default 'BROUILLON',
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique ("evaluationId", "eleveId")
);
create index idx_note_eleve on note("eleveId");
create trigger trg_note_updated before update on note
  for each row execute function touch_updated_at();

-- ============================================================
-- Finance école (soft-delete only via statuts)
-- ============================================================
create table type_frais (
  id uuid primary key default gen_random_uuid(),
  "etablissementId" uuid not null references etablissement(id),
  nom text not null,
  description text,
  statut statut_type_frais not null default 'ACTIF',
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique ("etablissementId", nom)
);
create index idx_type_frais_etab on type_frais("etablissementId");
create trigger trg_type_frais_updated before update on type_frais
  for each row execute function touch_updated_at();

-- Immuable après création : correction = nouveau tarif.
create table tarif_scolaire (
  id uuid primary key default gen_random_uuid(),
  "etablissementId" uuid not null references etablissement(id),
  "anneeScolaireId" uuid not null references annee_scolaire(id),
  "classeId" uuid not null references classe(id),
  "typeFraisId" uuid not null references type_frais(id),
  montant numeric(12, 2) not null,
  "createdAt" timestamptz not null default now(),
  unique ("anneeScolaireId", "classeId", "typeFraisId")
);
create index idx_tarif_etab on tarif_scolaire("etablissementId");

create table facture_eleve (
  id uuid primary key default gen_random_uuid(),
  "etablissementId" uuid not null references etablissement(id),
  "eleveId" uuid not null references eleve(id),
  "anneeScolaireId" uuid not null references annee_scolaire(id),
  "montantTotal" numeric(12, 2) not null,
  statut statut_facture not null default 'IMPAYE',
  "dateCreation" timestamptz not null default now(),
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
create index idx_facture_etab on facture_eleve("etablissementId");
create index idx_facture_eleve_annee on facture_eleve("eleveId", "anneeScolaireId");
create trigger trg_facture_updated before update on facture_eleve
  for each row execute function touch_updated_at();

create table ligne_facture (
  id uuid primary key default gen_random_uuid(),
  "factureId" uuid not null references facture_eleve(id),
  "typeFraisId" uuid not null references type_frais(id),
  designation text not null,
  montant numeric(12, 2) not null
);
create index idx_ligne_facture_facture on ligne_facture("factureId");

create table paiement (
  id uuid primary key default gen_random_uuid(),
  "factureId" uuid not null references facture_eleve(id),
  montant numeric(12, 2) not null,
  "datePaiement" timestamptz not null default now(),
  "modePaiement" mode_paiement not null,
  reference text,
  statut statut_paiement not null default 'PAYE',
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
create index idx_paiement_facture on paiement("factureId");
create trigger trg_paiement_updated before update on paiement
  for each row execute function touch_updated_at();

-- ============================================================
-- Documents
-- ============================================================
create table document (
  id uuid primary key default gen_random_uuid(),
  "etablissementId" uuid not null references etablissement(id),
  type type_document not null,
  reference text not null,
  "cheminFichier" text not null,
  "objetType" text not null,
  "objetId" text not null,
  "dateGeneration" timestamptz not null default now(),
  "createdById" uuid not null references utilisateur(id),
  statut statut_document not null default 'GENERE',
  unique ("etablissementId", reference)
);
create index idx_document_etab_type on document("etablissementId", type);
create index idx_document_objet on document("objetType", "objetId");

-- ============================================================
-- SaaS (abonnement plateforme)
-- ============================================================
create table plan_abonnement (
  id uuid primary key default gen_random_uuid(),
  nom text not null unique,
  duree text not null,
  prix numeric(12, 2) not null,
  fonctionnalites jsonb,
  "createdAt" timestamptz not null default now()
);

create table abonnement_etablissement (
  id uuid primary key default gen_random_uuid(),
  "etablissementId" uuid not null references etablissement(id),
  "planId" uuid not null references plan_abonnement(id),
  "dateDebut" timestamptz not null,
  "dateFin" timestamptz not null,
  statut statut_abonnement not null default 'ACTIF',
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
create index idx_abonnement_etab on abonnement_etablissement("etablissementId");
create trigger trg_abonnement_updated before update on abonnement_etablissement
  for each row execute function touch_updated_at();

create table paiement_abonnement (
  id uuid primary key default gen_random_uuid(),
  "abonnementId" uuid not null references abonnement_etablissement(id),
  montant numeric(12, 2) not null,
  date timestamptz not null default now(),
  "modePaiement" mode_paiement not null,
  reference text,
  "createdAt" timestamptz not null default now()
);
create index idx_paiement_abonnement_abonnement on paiement_abonnement("abonnementId");

-- ============================================================
-- Audit
-- ============================================================
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  "etablissementId" uuid references etablissement(id),
  "userId" uuid references utilisateur(id),
  action text not null,
  module text not null,
  "objetType" text not null,
  "objetId" text,
  "ancienneValeur" jsonb,
  "nouvelleValeur" jsonb,
  date timestamptz not null default now()
);
create index idx_audit_etab_date on audit_log("etablissementId", date);
create index idx_audit_user_date on audit_log("userId", date);
create index idx_audit_objet on audit_log("objetType", "objetId");

-- ============================================================
-- Row Level Security — applicative isolation replaced by DB-level RLS.
-- Pattern: rows are visible/writable when etablissement_id matches the
-- caller's JWT claim, or the caller is SUPER_ADMIN. Tables without a direct
-- etablissement_id column are scoped through their parent via EXISTS.
-- ============================================================

alter table etablissement enable row level security;
create policy etablissement_tenant on etablissement for all
  using (is_super_admin() or id = auth_etablissement_id())
  with check (is_super_admin() or id = auth_etablissement_id());

alter table utilisateur enable row level security;
create policy utilisateur_tenant on utilisateur for all
  using (is_super_admin() or "etablissementId" = auth_etablissement_id())
  with check (is_super_admin() or "etablissementId" = auth_etablissement_id());

alter table cycle enable row level security;
create policy cycle_read_all on cycle for select using (true);
create policy cycle_write_super_admin on cycle for insert with check (is_super_admin());
create policy cycle_update_super_admin on cycle for update using (is_super_admin());

alter table cycle_etablissement enable row level security;
create policy cycle_etablissement_tenant on cycle_etablissement for all
  using (is_super_admin() or "etablissementId" = auth_etablissement_id())
  with check (is_super_admin() or "etablissementId" = auth_etablissement_id());

alter table niveau enable row level security;
create policy niveau_read_all on niveau for select using (true);
create policy niveau_write_super_admin on niveau for insert with check (is_super_admin());
create policy niveau_update_super_admin on niveau for update using (is_super_admin());

alter table serie enable row level security;
create policy serie_read_all on serie for select using (true);
create policy serie_write_super_admin on serie for insert with check (is_super_admin());
create policy serie_update_super_admin on serie for update using (is_super_admin());

alter table annee_scolaire enable row level security;
create policy annee_scolaire_tenant on annee_scolaire for all
  using (is_super_admin() or "etablissementId" = auth_etablissement_id())
  with check (is_super_admin() or "etablissementId" = auth_etablissement_id());

alter table classe enable row level security;
create policy classe_tenant on classe for all
  using (is_super_admin() or "etablissementId" = auth_etablissement_id())
  with check (is_super_admin() or "etablissementId" = auth_etablissement_id());

alter table eleve enable row level security;
create policy eleve_tenant on eleve for all
  using (is_super_admin() or "etablissementId" = auth_etablissement_id())
  with check (is_super_admin() or "etablissementId" = auth_etablissement_id());

alter table responsable enable row level security;
create policy responsable_tenant on responsable for all
  using (is_super_admin() or "etablissementId" = auth_etablissement_id())
  with check (is_super_admin() or "etablissementId" = auth_etablissement_id());

alter table eleve_responsable enable row level security;
create policy eleve_responsable_tenant on eleve_responsable for all
  using (is_super_admin() or exists (
    select 1 from eleve e where e.id = eleve_responsable."eleveId" and e."etablissementId" = auth_etablissement_id()
  ))
  with check (is_super_admin() or exists (
    select 1 from eleve e where e.id = eleve_responsable."eleveId" and e."etablissementId" = auth_etablissement_id()
  ));

alter table inscription enable row level security;
create policy inscription_tenant on inscription for all
  using (is_super_admin() or "etablissementId" = auth_etablissement_id())
  with check (is_super_admin() or "etablissementId" = auth_etablissement_id());

alter table enseignant enable row level security;
create policy enseignant_tenant on enseignant for all
  using (is_super_admin() or "etablissementId" = auth_etablissement_id())
  with check (is_super_admin() or "etablissementId" = auth_etablissement_id());

alter table affectation_enseignant enable row level security;
create policy affectation_enseignant_tenant on affectation_enseignant for all
  using (is_super_admin() or "etablissementId" = auth_etablissement_id())
  with check (is_super_admin() or "etablissementId" = auth_etablissement_id());

alter table titularite_classe enable row level security;
create policy titularite_classe_tenant on titularite_classe for all
  using (is_super_admin() or exists (
    select 1 from classe c where c.id = titularite_classe."classeId" and c."etablissementId" = auth_etablissement_id()
  ))
  with check (is_super_admin() or exists (
    select 1 from classe c where c.id = titularite_classe."classeId" and c."etablissementId" = auth_etablissement_id()
  ));

alter table matiere enable row level security;
create policy matiere_tenant on matiere for all
  using (is_super_admin() or "etablissementId" = auth_etablissement_id())
  with check (is_super_admin() or "etablissementId" = auth_etablissement_id());

alter table programme_etablissement enable row level security;
create policy programme_etablissement_tenant on programme_etablissement for all
  using (is_super_admin() or "etablissementId" = auth_etablissement_id())
  with check (is_super_admin() or "etablissementId" = auth_etablissement_id());

alter table coefficient_matiere enable row level security;
create policy coefficient_matiere_tenant on coefficient_matiere for all
  using (is_super_admin() or exists (
    select 1 from programme_etablissement p
    where p.id = coefficient_matiere."programmeEtablissementId" and p."etablissementId" = auth_etablissement_id()
  ))
  with check (is_super_admin() or exists (
    select 1 from programme_etablissement p
    where p.id = coefficient_matiere."programmeEtablissementId" and p."etablissementId" = auth_etablissement_id()
  ));

alter table evaluation enable row level security;
create policy evaluation_tenant on evaluation for all
  using (is_super_admin() or exists (
    select 1 from classe c where c.id = evaluation."classeId" and c."etablissementId" = auth_etablissement_id()
  ))
  with check (is_super_admin() or exists (
    select 1 from classe c where c.id = evaluation."classeId" and c."etablissementId" = auth_etablissement_id()
  ));

alter table note enable row level security;
create policy note_tenant on note for all
  using (is_super_admin() or exists (
    select 1 from evaluation ev join classe c on c.id = ev."classeId"
    where ev.id = note."evaluationId" and c."etablissementId" = auth_etablissement_id()
  ))
  with check (is_super_admin() or exists (
    select 1 from evaluation ev join classe c on c.id = ev."classeId"
    where ev.id = note."evaluationId" and c."etablissementId" = auth_etablissement_id()
  ));

alter table type_frais enable row level security;
create policy type_frais_tenant on type_frais for all
  using (is_super_admin() or "etablissementId" = auth_etablissement_id())
  with check (is_super_admin() or "etablissementId" = auth_etablissement_id());

alter table tarif_scolaire enable row level security;
create policy tarif_scolaire_tenant on tarif_scolaire for all
  using (is_super_admin() or "etablissementId" = auth_etablissement_id())
  with check (is_super_admin() or "etablissementId" = auth_etablissement_id());

alter table facture_eleve enable row level security;
create policy facture_eleve_tenant on facture_eleve for all
  using (is_super_admin() or "etablissementId" = auth_etablissement_id())
  with check (is_super_admin() or "etablissementId" = auth_etablissement_id());

alter table ligne_facture enable row level security;
create policy ligne_facture_tenant on ligne_facture for all
  using (is_super_admin() or exists (
    select 1 from facture_eleve f where f.id = ligne_facture."factureId" and f."etablissementId" = auth_etablissement_id()
  ))
  with check (is_super_admin() or exists (
    select 1 from facture_eleve f where f.id = ligne_facture."factureId" and f."etablissementId" = auth_etablissement_id()
  ));

alter table paiement enable row level security;
create policy paiement_tenant on paiement for all
  using (is_super_admin() or exists (
    select 1 from facture_eleve f where f.id = paiement."factureId" and f."etablissementId" = auth_etablissement_id()
  ))
  with check (is_super_admin() or exists (
    select 1 from facture_eleve f where f.id = paiement."factureId" and f."etablissementId" = auth_etablissement_id()
  ));

alter table document enable row level security;
create policy document_tenant on document for all
  using (is_super_admin() or "etablissementId" = auth_etablissement_id())
  with check (is_super_admin() or "etablissementId" = auth_etablissement_id());

alter table plan_abonnement enable row level security;
create policy plan_abonnement_read_all on plan_abonnement for select using (true);
create policy plan_abonnement_write_super_admin on plan_abonnement for insert with check (is_super_admin());
create policy plan_abonnement_update_super_admin on plan_abonnement for update using (is_super_admin());

alter table abonnement_etablissement enable row level security;
create policy abonnement_etablissement_read on abonnement_etablissement for select
  using (is_super_admin() or "etablissementId" = auth_etablissement_id());
create policy abonnement_etablissement_write_super_admin on abonnement_etablissement for insert
  with check (is_super_admin());
create policy abonnement_etablissement_update_super_admin on abonnement_etablissement for update
  using (is_super_admin());

alter table paiement_abonnement enable row level security;
create policy paiement_abonnement_read on paiement_abonnement for select
  using (is_super_admin() or exists (
    select 1 from abonnement_etablissement a
    where a.id = paiement_abonnement."abonnementId" and a."etablissementId" = auth_etablissement_id()
  ));
create policy paiement_abonnement_write_super_admin on paiement_abonnement for insert
  with check (is_super_admin());

alter table audit_log enable row level security;
create policy audit_log_read on audit_log for select
  using (is_super_admin() or "etablissementId" = auth_etablissement_id());
create policy audit_log_insert on audit_log for insert
  with check (is_super_admin() or "etablissementId" = auth_etablissement_id());

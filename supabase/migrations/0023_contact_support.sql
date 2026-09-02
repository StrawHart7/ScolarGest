-- Contact support : une ecole ecrit a la plateforme, le SUPER_ADMIN repond.
--
-- Jusqu'ici `/profil/aide` repondait a sept questions frequentes et s'arretait
-- la. Une ecole bloquee sur autre chose n'avait aucun moyen de joindre qui que
-- ce soit depuis le produit. C'est le trou que cette table comble.
--
-- Modele repris de `demande_demo` (migration 0002) : une file, un statut, un
-- ecran SUPER_ADMIN. Deux differences qui changent les policies :
--   - l'auteur est authentifie et rattache a un etablissement, la ou une
--     demande de demo vient d'un anonyme ;
--   - l'ecole doit relire ce qu'elle a envoye et la reponse recue, la ou une
--     demande de demo n'est jamais rendue a son auteur.

create type categorie_support as enum (
  'COMPTE_ACCES',
  'NOTES_BULLETINS',
  'FINANCES',
  'ABONNEMENT_PAIEMENT',
  'ANOMALIE',
  'AUTRE'
);

create type statut_support as enum ('NOUVELLE', 'EN_COURS', 'RESOLUE', 'FERMEE');

create table support_demande (
  id uuid primary key default gen_random_uuid(),
  "etablissementId" uuid not null references etablissement(id),

  -- L'auteur est reference pour pouvoir le recontacter, mais son role, son nom
  -- et son email sont *figes* a l'envoi. Un compte peut changer de role, etre
  -- desactive, ou voir son email corrige : la demande doit continuer de dire
  -- qui l'a ecrite et a quel titre au moment ou elle a ete ecrite. Meme
  -- raisonnement que l'historisation des tarifs et des coefficients.
  "auteurId" uuid references utilisateur(id),
  "auteurNom" text not null,
  "auteurEmail" text not null,
  "auteurRole" role not null,

  categorie categorie_support not null,
  sujet text not null,
  message text not null,

  -- Chemin de la page depuis laquelle la demande est partie. Sans lui, la
  -- moitie des demandes commencent par un aller-retour « sur quel ecran ? ».
  "pageOrigine" text,

  statut statut_support not null default 'NOUVELLE',

  -- Une seule reponse, pas un fil de discussion. Un fil demanderait une table
  -- de messages, des notifications et une notion de « non lu » ; le volume
  -- attendu ne le justifie pas, et rien ici n'empeche de l'ajouter plus tard.
  "reponseSupport" text,
  "repondueLe" timestamptz,

  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create index idx_support_demande_statut on support_demande(statut, "createdAt" desc);
create index idx_support_demande_etablissement
  on support_demande("etablissementId", "createdAt" desc);

create trigger trg_support_demande_updated before update on support_demande
  for each row execute function touch_updated_at();

alter table support_demande enable row level security;

-- Lecture : son propre etablissement, ou tout pour le SUPER_ADMIN.
create policy support_demande_select on support_demande for select
  using (is_super_admin() or "etablissementId" = auth_etablissement_id());

-- Ecriture : une ecole ne peut deposer que sous son propre etablissement.
-- La comparaison est refaite cote service (defense en profondeur), mais elle
-- doit exister ici : c'est la seule barriere qui tienne si un jour un appel
-- passe a cote du service.
create policy support_demande_insert_tenant on support_demande for insert
  to authenticated
  with check ("etablissementId" = auth_etablissement_id());

-- Mise a jour reservee au SUPER_ADMIN. `statut` et `reponseSupport` sont le
-- travail du support : laisser l'ecole les ecrire lui permettrait de se
-- repondre a elle-meme, ou de refermer une demande que personne n'a traitee.
create policy support_demande_update_super_admin on support_demande for update
  using (is_super_admin())
  with check (is_super_admin());

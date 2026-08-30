-- Identité visuelle des documents générés (bulletins et reçus) : logo de
-- l'établissement et filigrane.
--
-- Pourquoi une table dédiée plutôt que des colonnes sur `etablissement` :
-- cette dernière n'est écrite que par le SUPER_ADMIN (`createEtablissement`
-- est gardée par `requireRole()` sans argument, et aucun `updateEtablissement`
-- n'existe). Le logo et le filigrane relèvent du Directeur, pas de la
-- plateforme — les loger ici évite d'assouplir une garde de niveau
-- plateforme pour un réglage de présentation.
--
-- La colonne `etablissement.logo` existe depuis 0001 mais n'a jamais été
-- utilisée (ni dans l'interface TypeScript, ni dans les gabarits PDF) : elle
-- est laissée en l'état, non reprise ici, pour ne pas préempter un usage
-- côté SUPER_ADMIN.
--
-- L'existence de la ligne vaut « les paramètres ont déjà été proposés une
-- fois » : c'est ce qui permet de poser la question à la première génération
-- de document sans jamais la reposer, tout en gardant le réglage modifiable
-- depuis les paramètres (même motif que `onboarding_progression`).

create table parametres_document (
  id uuid primary key default gen_random_uuid(),
  "etablissementId" uuid not null references etablissement(id) unique,
  -- Texte libre : nom de l'établissement, « COPIE », « ORIGINAL », une devise…
  "filigraneTexte" text,
  "filigraneActif" boolean not null default false,
  -- Chemin dans le bucket privé `documents` ({etablissementId}/identite/...).
  -- Le fichier est lu côté serveur et intégré en data URI au rendu : le
  -- bucket reste privé, aucune URL publique n'est exposée.
  "logoChemin" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create trigger trg_parametres_document_updated before update on parametres_document
  for each row execute function touch_updated_at();

alter table parametres_document enable row level security;
create policy parametres_document_tenant on parametres_document for all
  using (is_super_admin() or "etablissementId" = auth_etablissement_id())
  with check (is_super_admin() or "etablissementId" = auth_etablissement_id());

-- Progression de l'onboarding conversationnel (/demarrage).
--
-- L'avancement réel se DÉDUIT des données (une année ACTIVE existe-t-elle ?
-- des cycles sont-ils activés ? des classes existent-elles ?) — cette table ne
-- duplique donc pas l'état de configuration. Elle ne persiste que ce qui n'est
-- pas déductible :
--   * "etapesIgnorees" : les étapes facultatives volontairement sautées, qu'il
--     ne faut plus reproposer (sans quoi « aucun enseignant » serait
--     indiscernable de « je le ferai plus tard »).
--   * "masqueeLe"      : la bannière de rappel du tableau de bord a été fermée.
--   * l'existence même de la ligne : l'utilisateur a DÉJÀ été redirigé une fois
--     vers /demarrage. C'est ce qui rend la redirection interruptible plutôt
--     que forcée — quitter le questionnaire ne peut pas déclencher une boucle.
--
-- La progression est par utilisateur et non par établissement : le Directeur et
-- la Secrétaire suivent deux parcours distincts (structure vs finance).

create table onboarding_progression (
  id uuid primary key default gen_random_uuid(),
  "etablissementId" uuid not null references etablissement(id),
  "utilisateurId" uuid not null references utilisateur(id),
  "etapesIgnorees" text[] not null default '{}',
  "masqueeLe" timestamptz,
  "termineeLe" timestamptz,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique ("etablissementId", "utilisateurId")
);

create trigger trg_onboarding_progression_updated before update on onboarding_progression
  for each row execute function touch_updated_at();

alter table onboarding_progression enable row level security;
create policy onboarding_progression_tenant on onboarding_progression for all
  using (is_super_admin() or "etablissementId" = auth_etablissement_id())
  with check (is_super_admin() or "etablissementId" = auth_etablissement_id());

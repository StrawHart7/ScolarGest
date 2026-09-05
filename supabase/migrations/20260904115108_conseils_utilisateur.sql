-- Conseils : ce que l'utilisateur a deja vu, reporte ou releguee.
--
-- La fonctionnalite propose, au fil de l'usage, ce que la plateforme sait
-- faire et que l'utilisateur n'a pas encore fait. Le catalogue vit dans
-- `src/lib/conseils/catalogue.ts` et le classement dans `choix.ts` ; cette
-- table ne porte que ce qui n'est pas deductible des donnees.
--
-- **Elle ne dit jamais qu'un conseil est accompli.** C'est la doctrine deja
-- retenue pour `onboarding_progression` (migration 0012) : la pertinence se
-- deduit des donnees — une sonde compte des lignes — et la dupliquer ici la
-- ferait diverger des que la configuration passerait par les ecrans
-- habituels plutot que par le conseil. Ce qui est stocke, c'est uniquement la
-- decision de l'utilisateur : j'ai reporte, j'ai ecarte, j'ai suivi.
--
-- **Aucun statut terminal, deliberement.** « Ne revient plus jamais » punit
-- quelqu'un qui a seulement voulu dire « pas maintenant » : le besoin peut
-- naitre six mois plus tard. Un conseil ecarte est donc RELEGUE — range en
-- fin de file, servi lorsque tout le reste est epuise. D'ou le nom : `REJETE`
-- aurait laisse croire qu'on peut fermer la porte.

create type statut_conseil as enum (
  'PROPOSE',   -- affiche, sans decision
  'REPORTE',   -- « plus tard » : revient a `reporteJusquA`
  'RELEGUE',   -- « pas pour moi » : revient en fin de file
  'SUIVI'      -- l'utilisateur a suivi le lien
);

create table conseil_utilisateur (
  id uuid primary key default gen_random_uuid(),
  "etablissementId" uuid not null references etablissement(id),
  "utilisateurId" uuid not null references utilisateur(id),

  -- Identifiant du catalogue applicatif, pas une cle etrangere : le catalogue
  -- est du code, il evolue a chaque livraison de fonctionnalite, et une table
  -- de reference imposerait une migration pour chaque nouveau conseil. Une
  -- valeur devenue inconnue est simplement ignoree a la lecture.
  "conseilId" text not null,

  statut statut_conseil not null default 'PROPOSE',

  -- Fin du report « plus tard ».
  "reporteJusquA" timestamptz,

  -- Date de la derniere relegation : elle ordonne la file de reprise, ou le
  -- plus anciennement ecarte revient en premier.
  "relegueLe" timestamptz,

  -- Le plancher d'attente s'allonge avec ce compteur (30, 90 puis 180 jours).
  -- Ecarter trois fois le meme conseil dit quelque chose, sans que cela ferme
  -- definitivement la porte.
  "nombreRelegations" integer not null default 0,

  "vuLe" timestamptz,
  "nombreVues" integer not null default 0,

  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),

  -- Un conseil est suivi *par personne*, pas par ecole : le Directeur et la
  -- Secretaire apprennent chacun a leur rythme. Partager l'etat ferait
  -- disparaitre chez l'un un conseil que l'autre n'a jamais vu.
  unique ("etablissementId", "utilisateurId", "conseilId")
);

-- La lecture du choix se fait toujours pour un utilisateur donne.
create index idx_conseil_utilisateur_personne
  on conseil_utilisateur("utilisateurId", "conseilId");

create trigger trg_conseil_utilisateur_updated before update on conseil_utilisateur
  for each row execute function touch_updated_at();

alter table conseil_utilisateur enable row level security;

-- Plus strict qu'`onboarding_progression`, qui se contente du tenant : l'etat
-- d'un conseil est strictement personnel, et `utilisateur.id` est deja l'uid
-- d'authentification. Rien ne justifie qu'un Directeur puisse ecarter un
-- conseil au nom de sa Secretaire.
create policy conseil_utilisateur_personnel on conseil_utilisateur for all
  using (
    is_super_admin()
    or ("etablissementId" = auth_etablissement_id() and "utilisateurId" = auth.uid())
  )
  with check (
    is_super_admin()
    or ("etablissementId" = auth_etablissement_id() and "utilisateurId" = auth.uid())
  );

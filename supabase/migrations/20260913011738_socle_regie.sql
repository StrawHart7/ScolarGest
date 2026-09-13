-- Régie — M0. Le socle : un schéma, un rôle, une frontière vérifiable
-- ============================================================
-- Jalon M0 du plan « Régie » (ScolarGest-Documentation/70-Console-fondateur/
-- 04-Plan-du-projet.md). **Aucune interface, aucun écran, aucun comportement
-- modifié dans le produit.** Cette migration est intégralement additive : un
-- schéma neuf, un rôle neuf, une fonction neuve. Rien de ce qui existe n'est
-- touché.
--
-- ## Le principe que tout le reste sert
--
-- > La Régie n'est jamais sur le chemin critique d'une école.
--
-- Régie en panne, à moitié faite ou jamais terminée : les écoles travaillent.
-- C'est pourquoi `controle` ne porte **aucune clé étrangère vers `public`** et
-- pourquoi l'émetteur d'événements avale ses propres erreurs. Une télémétrie
-- qui peut faire échouer un encaissement est une régression, pas un outil.
--
-- ## Le renversement du modèle d'accès
--
-- Le produit principal expose sa base au navigateur — l'URL et la clé anon
-- sont dans le bundle par construction — et la RLS est la barrière. C'est le
-- bon modèle pour du multi-tenant.
--
-- La Régie prend l'inverse, **parce qu'elle le peut** : un seul utilisateur,
-- aucun accès depuis le navigateur. Tout passe par une connexion Postgres
-- côté serveur portant le rôle `regie`, qui n'a de droits que sur ce qui est
-- nommé plus bas. La confidentialité entre la Régie et le contenu des écoles
-- cesse alors d'être une discipline de code : elle devient une requête.


create schema controle;

comment on schema controle is
  'Plan de contrôle de la Régie. Jamais exposé à PostgREST, jamais lisible par une école. Ne porte aucune clé étrangère vers public : le produit doit pouvoir vivre sans ce schéma.';

-- PostgREST ne sert que les schémas déclarés dans les réglages du projet
-- (`public`, `graphql_public`). `controle` en est donc invisible par défaut.
-- Ce `revoke` est la ceinture : si quelqu'un ajoutait un jour `controle` à la
-- liste exposée, les rôles de l'API n'y auraient toujours aucun droit.
revoke all on schema controle from anon, authenticated;


-- ============================================================
-- 1. La frontière, écrite en donnée
-- ============================================================
-- Le plan prévoyait une liste nominative de tables dans un commentaire, et un
-- test qui la recopie. Deux copies d'une même règle finissent par diverger :
-- c'est exactement le défaut de `src/lib/bulletins.ts` avant qu'il n'existe.
--
-- La liste vit donc **en base**. Le contrôle devient une anti-jointure pure,
-- sans vocabulaire à tenir à jour ailleurs, et élargir la frontière exige une
-- migration — donc un geste relu, daté, et visible en revue.
create table controle.frontiere_autorisee (
  "nomTable" text primary key,
  mode text not null check (mode in ('LECTURE', 'ECRITURE')),
  motif text not null check (length(motif) >= 20)
);

comment on table controle.frontiere_autorisee is
  'Les seules tables de public que le rôle regie peut toucher. Toute ligne ajoutée ici élargit ce que la Régie voit du produit : le motif est obligatoire, et scripts/verifier-frontiere-regie.ts échoue si les droits réels débordent cette liste.';

insert into controle.frontiere_autorisee ("nomTable", mode, motif) values
  ('matiere_officielle',   'ECRITURE', 'Référentiel national des matières : la Régie en est l''éditeur.'),
  ('coefficient_officiel', 'ECRITURE', 'Barème national versionné : la Régie ratifie, ferme et ouvre les lignes.'),
  ('calendrier_national',  'ECRITURE', 'Découpage officiel de l''année scolaire, publié par la Régie.'),
  ('cycle',                'LECTURE',  'Catalogue système sans donnée d''école. Nécessaire pour nommer un niveau.'),
  ('niveau',               'LECTURE',  'Catalogue système sans donnée d''école. Cible d''un coefficient officiel.'),
  ('serie',                'LECTURE',  'Catalogue système sans donnée d''école. Différencie le barème au lycée.');


-- ============================================================
-- 2. Ce qu'un événement a le droit de transporter
-- ============================================================
-- Contrainte absolue du plan : `meta` ne contient **jamais** de contenu — pas
-- de nom d'élève, pas de montant, pas de note. Écrire cette règle dans la
-- revue de code ne la tient pas ; un an plus tard quelqu'un ajoute un champ
-- « pour déboguer » et la promesse de confidentialité est morte sans bruit.
--
-- Trois verrous, tous portés par la base :
--   1. le nom de la clé doit appartenir à un vocabulaire fermé ;
--   2. la valeur est scalaire — ni objet, ni tableau, donc pas de charge utile
--      imbriquée ;
--   3. une chaîne fait au plus 64 caractères. C'est ce qui empêche de glisser
--      un nom complet dans `entite` ou une phrase dans `code`.
--
-- Une fonction plutôt qu'un CHECK écrit en ligne : un CHECK ne peut pas porter
-- de sous-requête, et `jsonb_object_keys` en est une.
create or replace function controle.meta_sans_contenu(meta jsonb)
returns boolean
language sql
immutable
as $$
  select case
    when meta is null then true
    -- Un scalaire ou un tableau à la racine n'est pas un jeu de clés : refuser
    -- plutôt que laisser `jsonb_object_keys` lever une erreur illisible.
    when jsonb_typeof(meta) <> 'object' then false
    else coalesce((
      select bool_and(
        cle in (
          'route', 'action', 'entite', 'code', 'statut', 'origine', 'resultat',
          'cycle', 'niveau', 'serie', 'periode', 'role', 'version', 'canal',
          'duree_ms', 'nombre', 'taille', 'source'
        )
        and jsonb_typeof(meta -> cle) in ('string', 'number', 'boolean')
        and (jsonb_typeof(meta -> cle) <> 'string' or length(meta ->> cle) <= 64)
      )
      from jsonb_object_keys(meta) as cle
    ), true)
  end;
$$;

comment on function controle.meta_sans_contenu(jsonb) is
  'Vocabulaire fermé, valeurs scalaires, chaînes bornées à 64 caractères. Élargir la liste des clés est une décision de confidentialité, pas un détail technique.';


-- ============================================================
-- 3. Le flux d'événements
-- ============================================================
-- Append-only, et volontairement **sans clé étrangère** vers `etablissement` :
--   - `controle` ne doit rien contraindre dans `public` — la suppression ou la
--     migration d'une école ne peut pas buter sur de la télémétrie ;
--   - la trace doit survivre à son sujet. Un `on delete cascade` effacerait
--     précisément l'historique qu'on garde pour comprendre un départ.
create table controle.evenement (
  id bigint generated always as identity primary key,
  "survenuLe" timestamptz not null default now(),
  type text not null check (type ~ '^[a-z][a-z0-9_.]{2,48}$'),
  "etablissementId" uuid,
  role text,
  meta jsonb not null default '{}'::jsonb,
  constraint evenement_meta_sans_contenu check (controle.meta_sans_contenu(meta))
);

comment on table controle.evenement is
  'Flux append-only émis par le produit principal. Type, école, rôle, horodatage. Jamais de contenu : voir controle.meta_sans_contenu.';

-- Le cockpit lit « les N derniers », puis filtre par type ou par école. Trois
-- index, parce que trois questions.
create index idx_evenement_survenu on controle.evenement ("survenuLe" desc);
create index idx_evenement_type on controle.evenement (type, "survenuLe" desc);
create index idx_evenement_etablissement on controle.evenement ("etablissementId", "survenuLe" desc)
  where "etablissementId" is not null;


-- ============================================================
-- 4. L'émetteur, côté produit
-- ============================================================
-- Une fonction `SECURITY DEFINER` dans `public`, appelable par une session
-- d'école. Ainsi `authenticated` n'a **aucun droit direct** sur `controle` :
-- il ne peut ni lire le flux, ni y écrire autre chose que ce que cette
-- fonction accepte.
--
-- **L'appelant ne choisit pas son établissement.** `auth_etablissement_id()`
-- est lu ici, du JWT vérifié, jamais reçu en paramètre : sinon une école
-- signerait ses événements du nom d'une autre, et le flux — qui sert à décider
-- qui appeler et quand — deviendrait une source d'erreur plutôt qu'une source.
--
-- Même raisonnement pour le rôle. C'est la leçon de `support_demande`, dont la
-- policy fige `auteurId = auth.uid()` pour que l'identité figée vaille quelque
-- chose.
create or replace function public.emettre_evenement(
  type_evenement text,
  meta jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, controle, pg_catalog
as $$
begin
  -- Une session est exigée : la télémétrie anonyme n'apprendrait rien et
  -- ouvrirait une porte d'écriture à la clé anon, qui est publique.
  if auth.uid() is null then
    return;
  end if;

  insert into controle.evenement (type, "etablissementId", role, meta)
  values (
    type_evenement,
    auth_etablissement_id(),
    auth_role(),
    coalesce(meta, '{}'::jsonb)
  );
end;
$$;

comment on function public.emettre_evenement(text, jsonb) is
  'Émet un événement de télémétrie. L''établissement et le rôle sont lus du JWT, jamais reçus : une école ne peut pas écrire au nom d''une autre.';

revoke all on function public.emettre_evenement(text, jsonb) from public;
grant execute on function public.emettre_evenement(text, jsonb) to authenticated;


-- ============================================================
-- 5. Le journal de la Régie
-- ============================================================
-- Tout geste de la Régie s'y inscrit. Chaîné par empreinte : chaque ligne
-- reprend l'empreinte de la précédente, si bien qu'effacer ou réécrire une
-- ligne rompt la chaîne de toutes les suivantes.
--
-- **Pourquoi un chaînage et pas seulement un `revoke`.** Le rôle `regie` n'a
-- déjà ni UPDATE ni DELETE ici, et un déclencheur les refuse. Mais le
-- propriétaire de la base, lui, peut tout. Le chaînage ne rend pas la
-- falsification impossible — il la rend **détectable**, ce qui est la seule
-- garantie honnête qu'un journal puisse offrir à celui qui l'administre.
create table controle.journal (
  sequence bigint generated always as identity primary key,
  "ecritLe" timestamptz not null default now(),
  acteur text not null,
  action text not null,
  cible text,
  "etablissementId" uuid,
  -- Obligatoire dès qu'une école est concernée : c'est la règle A8 du plan.
  -- Tenue par une contrainte plutôt que par l'écran, qui se contourne.
  motif text,
  details jsonb not null default '{}'::jsonb,
  "empreintePrecedente" text,
  empreinte text not null,
  constraint journal_motif_si_ecole
    check ("etablissementId" is null or (motif is not null and length(motif) >= 10))
);

comment on table controle.journal is
  'Audit de la Régie, append-only et chaîné par empreinte. Un motif d''au moins 10 caractères est obligatoire dès qu''une école est nommée.';

create index idx_journal_ecrit on controle.journal ("ecritLe" desc);
create index idx_journal_etablissement on controle.journal ("etablissementId", "ecritLe" desc)
  where "etablissementId" is not null;

create or replace function controle.fn_chainer_journal()
returns trigger
language plpgsql
security definer
set search_path = controle, pg_catalog
as $$
declare
  v_precedente text;
begin
  -- Deux insertions concurrentes liraient la même « dernière ligne » et
  -- produiraient deux maillons frères : la chaîne se dédoublerait sans que
  -- rien ne le signale. Le verrou les sérialise. Sur un outil à un seul
  -- utilisateur, son coût est nul ; sans lui, la garantie du chaînage aussi.
  perform pg_advisory_xact_lock(hashtext('controle.journal'));

  select empreinte into v_precedente
    from controle.journal
   order by sequence desc
   limit 1;

  new."empreintePrecedente" := v_precedente;
  new.empreinte := encode(
    sha256(
      convert_to(
        coalesce(v_precedente, '')
          || '|' || to_char(new."ecritLe" at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US')
          || '|' || new.acteur
          || '|' || new.action
          || '|' || coalesce(new.cible, '')
          || '|' || coalesce(new."etablissementId"::text, '')
          || '|' || coalesce(new.motif, '')
          || '|' || new.details::text,
        'UTF8'
      )
    ),
    'hex'
  );
  return new;
end;
$$;

create trigger trg_chainer_journal
  before insert on controle.journal
  for each row execute function controle.fn_chainer_journal();

-- Un journal modifiable ne prouve rien. Les droits suffiraient pour le rôle
-- `regie`, mais un déclencheur dit **pourquoi** au lieu de renvoyer un refus
-- de permission nu, et il vaut pour tout appelant.
create or replace function controle.fn_journal_immuable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Le journal de la Régie est append-only : une ligne ne se modifie ni ne se supprime.'
    using errcode = '42501';
end;
$$;

create trigger trg_journal_immuable
  before update or delete on controle.journal
  for each row execute function controle.fn_journal_immuable();


-- ============================================================
-- 6. L'opérateur
-- ============================================================
-- Compte **distinct** du SUPER_ADMIN applicatif (règle A3 du plan) : les deux
-- barrières doivent être indépendantes, sinon compromettre la session du
-- produit donne la Régie par-dessus le marché.
--
-- Le secret TOTP et l'empreinte du mot de passe vivent ici plutôt qu'en
-- variables d'environnement : une rotation ne doit pas exiger un redéploiement,
-- et `derniereConnexion` n'a de sens qu'en base.
create table controle.operateur (
  id uuid primary key default gen_random_uuid(),
  identifiant text not null unique,
  "empreinteMotDePasse" text not null,
  -- Nul tant que le second facteur n'est pas armé. L'application refuse la
  -- connexion dans cet état sauf pendant l'enrôlement : un compte à un seul
  -- facteur n'est pas un compte de Régie.
  "secretTotp" text,
  "totpArmeLe" timestamptz,
  "derniereConnexion" timestamptz,
  "echecsConsecutifs" int not null default 0,
  "bloqueJusqua" timestamptz,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

comment on table controle.operateur is
  'Comptes de la Régie. Sans rapport avec auth.users : deux barrières indépendantes (règle A3 du plan).';

create trigger trg_operateur_updated
  before update on controle.operateur
  for each row execute function public.touch_updated_at();


-- ============================================================
-- 7. Le rôle `regie`
-- ============================================================
-- `login` sans mot de passe : Postgres refuse l'authentification d'un rôle
-- dont le mot de passe est nul, donc le rôle est inerte tant que personne ne
-- lui en pose un. Le secret n'entre jamais dans le dépôt — il se pose hors
-- migration, une fois, et vit dans les variables d'environnement de la Régie.
--
--   alter role regie with password '<secret>';
--
-- `noinherit nocreatedb nocreaterole nosuperuser` : rien d'hérité, rien
-- d'implicite. Tout ce que ce rôle peut faire est écrit ci-dessous, en toutes
-- lettres.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'regie') then
    create role regie login noinherit nocreatedb nocreaterole nosuperuser;
  end if;
end;
$$;

comment on role regie is
  'Connexion de la Régie. Droits limités au schéma controle et aux tables listées dans controle.frontiere_autorisee.';

-- Le plan de contrôle, en entier.
grant usage on schema controle to regie;
grant select, insert, update, delete on all tables in schema controle to regie;
grant usage, select on all sequences in schema controle to regie;
grant execute on all functions in schema controle to regie;

-- Sauf le journal, qui ne se réécrit pas.
revoke update, delete on controle.journal from regie;
-- Et la frontière, qui ne s'élargit que par migration. Un outil qui peut
-- s'accorder des droits à lui-même n'en a aucun.
revoke insert, update, delete on controle.frontiere_autorisee from regie;

-- Les tables nouvelles de `controle` doivent hériter des mêmes droits, sinon
-- la migration suivante livrerait une table que la Régie ne voit pas — et le
-- défaut se découvrirait à l'écran, pas au déploiement.
alter default privileges in schema controle
  grant select, insert, update, delete on tables to regie;
alter default privileges in schema controle
  grant usage, select on sequences to regie;
alter default privileges in schema controle
  grant execute on functions to regie;

-- Et dans `public`, exactement ce que `controle.frontiere_autorisee` déclare.
-- `usage` sur le schéma seul ne donne accès à aucune table : il rend les
-- tables nommées ci-dessous atteignables, rien de plus.
grant usage on schema public to regie;

grant select, insert, update on public.matiere_officielle to regie;
grant select, insert, update on public.coefficient_officiel to regie;
grant select, insert, update on public.calendrier_national to regie;
grant select on public.cycle to regie;
grant select on public.niveau to regie;
grant select on public.serie to regie;

-- Pas de DELETE, même sur le référentiel. Une valeur nationale erronée se
-- **ferme** (`valableJusqua`) et se remplace ; l'effacer réécrirait le passé
-- des écoles qui l'ont projetée. C'est l'invariant d'historisation du produit,
-- tenu ici par un droit manquant plutôt que par une consigne.

-- Les tables de `public` qui ne sont pas nommées ci-dessus n'ont reçu aucun
-- droit : Postgres ne donne rien par défaut. Les **fonctions**, elles, en
-- donnent un par défaut à tout le monde — c'est l'objet de la section 9, et
-- c'est ce qui aurait rendu tout ce qui précède décoratif.


-- ============================================================
-- 8. Le contrôle de la frontière, en une requête
-- ============================================================
-- C'est la pièce qui transforme une promesse en fait vérifiable. Elle est
-- appelée par `scripts/verifier-frontiere-regie.ts` côté produit, et elle sera
-- rejouée à chaque déploiement de la Régie : si elle renvoie une seule ligne,
-- le déploiement échoue.
--
-- **`has_table_privilege` plutôt que `information_schema.role_table_grants`.**
-- Cette vue ne montre que les droits dont l'appelant est bénéficiaire ou
-- donneur — elle peut donc répondre « rien » à quelqu'un qui n'a simplement
-- pas le droit de voir, et un contrôle de sécurité qui rassure à tort est pire
-- que pas de contrôle. `has_table_privilege` répond sur les droits **effectifs**
-- du rôle, ce qui inclut ce qui lui arrive par le pseudo-rôle PUBLIC ou par
-- appartenance à un autre rôle. C'est exactement la question posée.
create or replace function public.regie_frontiere_debordements()
returns table (objet text, privilege text, constat text)
language plpgsql
stable
security definer
set search_path = public, controle, pg_catalog
as $fn$
begin
  -- Le rôle absent se dit d'abord, et on s'arrête là. Poursuivre appellerait
  -- `has_table_privilege` sur un rôle inexistant, ce qui **lève une erreur**
  -- au lieu de rendre un verdict — et une fonction de contrôle qui explose
  -- n'apprend rien à celui qui la lance.
  if not exists (select 1 from pg_roles where rolname = 'regie') then
    return query select
      'role regie'::text,
      'ABSENT'::text,
      'Le rôle regie n''existe pas : les contrôles de non-accès ne prouvent rien'::text;
    return;
  end if;

  return query
  -- (a) Tables de `public` que la Régie peut toucher au-delà de la frontière.
  select
    c.relname::text,
    p.priv::text,
    case
      when f."nomTable" is null
        then 'Table absente de controle.frontiere_autorisee'
      when f.mode = 'LECTURE'
        then 'Droit d''écriture sur une table déclarée en LECTURE'
      else 'Privilège hors du contrat (seuls SELECT, INSERT, UPDATE sont prévus)'
    end
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  cross join lateral (
    values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')
  ) as p(priv)
  left join controle.frontiere_autorisee f on f."nomTable" = c.relname
  where n.nspname = 'public'
    and c.relkind in ('r', 'p', 'v', 'm', 'f')
    and has_table_privilege('regie', c.oid, p.priv)
    and (
      f."nomTable" is null
      or (f.mode = 'LECTURE' and p.priv <> 'SELECT')
      or (f.mode = 'ECRITURE' and p.priv not in ('SELECT', 'INSERT', 'UPDATE'))
    )

  union all

  -- (b) Schémas atteignables hors des deux prévus. `auth` et `storage` sont
  -- les deux à surveiller : y accéder donnerait les comptes et les fichiers
  -- des écoles sans jamais toucher une table de `public`.
  select
    'schema ' || n.nspname,
    'USAGE',
    'Schéma atteignable par la Régie hors de controle et public'
  from pg_namespace n
  where n.nspname not in ('controle', 'public', 'pg_catalog', 'information_schema')
    and n.nspname not like 'pg_%'
    and has_schema_privilege('regie', n.oid, 'USAGE')

  union all

  -- (c) Appartenance à un autre rôle. `regie` est créé `noinherit`, mais un
  -- `set role` reste possible pour un membre : l'appartenance elle-même est le
  -- défaut, pas l'héritage.
  select
    'role ' || r.rolname,
    'MEMBER',
    'La Régie est membre d''un autre rôle : ses droits ne sont plus ceux écrits ici'
  from pg_auth_members m
  join pg_roles r on r.oid = m.roleid
  join pg_roles g on g.oid = m.member
  where g.rolname = 'regie'

  union all

  -- (d) Fonctions de `public` exécutables par la Régie. Une fonction
  -- `SECURITY DEFINER` est un contournement complet de la frontière : elle
  -- s'exécute avec les droits de son propriétaire. Aucune n'est prévue.
  select
    'function ' || p.proname,
    'EXECUTE',
    'Fonction de public exécutable par la Régie : un SECURITY DEFINER contournerait toute la frontière'
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and has_function_privilege('regie', p.oid, 'EXECUTE')

  union all

  -- (e) **Les contrôles positifs.** Une frontière se vérifie dans les deux
  -- sens : un rôle qui ne peut rien faire passe évidemment tous les contrôles
  -- de non-accès. Si la Régie ne peut pas lire ce que la frontière lui
  -- déclare, le verdict « aucun débordement » ne veut plus rien dire.
  select 'contrôle positif ' || f."nomTable", 'SELECT',
         'Droit déclaré dans la frontière mais absent en base : la Régie ne peut pas faire son travail'
  from controle.frontiere_autorisee f
  where to_regclass('public.' || quote_ident(f."nomTable")) is not null
    and not has_table_privilege('regie', ('public.' || quote_ident(f."nomTable"))::regclass, 'SELECT')

  union all

  select 'contrôle positif ' || f."nomTable", 'UPDATE',
         'Table déclarée en ECRITURE mais non modifiable par la Régie'
  from controle.frontiere_autorisee f
  where f.mode = 'ECRITURE'
    and to_regclass('public.' || quote_ident(f."nomTable")) is not null
    and not has_table_privilege('regie', ('public.' || quote_ident(f."nomTable"))::regclass, 'UPDATE')

  union all

  -- (f) Et la frontière ne doit pas nommer une table qui n'existe pas : une
  -- ligne orpheline rendrait le contrôle positif muet sur ce point précis.
  select 'frontière ' || f."nomTable", 'INTROUVABLE',
         'controle.frontiere_autorisee nomme une table absente de public'
  from controle.frontiere_autorisee f
  where to_regclass('public.' || quote_ident(f."nomTable")) is null;
end;
$fn$;

comment on function public.regie_frontiere_debordements() is
  'Doit renvoyer zéro ligne, en permanence. Chaque ligne est un droit que la Régie possède au-delà de controle.frontiere_autorisee. Exécutée par scripts/verifier-frontiere-regie.ts et à chaque déploiement de la Régie.';

-- Le résultat ne dit rien d'une école et tout de la plateforme : réservé au
-- service-role, qui est la clé des outils, et refusé aux deux rôles de l'API.
revoke all on function public.regie_frontiere_debordements() from public;
revoke all on function public.regie_frontiere_debordements() from anon, authenticated;
grant execute on function public.regie_frontiere_debordements() to service_role;

-- ============================================================
-- 9. Refermer le pseudo-rôle PUBLIC sur les fonctions
-- ============================================================
-- **C'est la seule partie de cette migration qui touche l'existant**, et elle
-- mérite d'être lue en entier avant d'être appliquée.
--
-- Postgres accorde EXECUTE au pseudo-rôle PUBLIC sur toute fonction nouvelle.
-- `regie` en est membre par construction — tout rôle l'est — donc `grant usage
-- on schema public` lui donnait de fait le droit d'appeler les vingt-huit
-- fonctions du produit. Les neuf `SECURITY DEFINER` s'exécutent avec les droits
-- de leur propriétaire : une seule d'entre elles suffit à faire tomber la
-- frontière entière, sans qu'aucun droit de table n'ait bougé. Le contrôle (d)
-- ci-dessus aurait signalé les vingt-huit à chaque exécution.
--
-- **Pourquoi ce retrait ne change rien pour le produit.** L'ACL réelle des
-- vingt-huit fonctions a été relevée avant d'écrire ces lignes : chacune porte
-- déjà, en plus de la ligne PUBLIC, des droits **nominatifs** — `anon`,
-- `authenticated` et `service_role` pour vingt-six d'entre elles,
-- `service_role` seul pour `fn_expirer_abonnements` et
-- `fn_purger_operations_client`. Ces droits nominatifs ne sont pas touchés ici.
-- Retirer PUBLIC ne retire donc l'accès à personne qui l'utilisait : il ne le
-- retire qu'aux rôles qui n'ont jamais été nommés, ce qui est exactement
-- l'intention.
--
-- Ces droits nominatifs viennent des `default privileges` que Supabase pose sur
-- `public` — c'est pourquoi toute fonction créée par une migration les reçoit
-- sans qu'on l'écrive. Le `alter default privileges` final ne retire que la
-- ligne PUBLIC de ce mécanisme ; les trois rôles de l'API continuent d'être
-- servis comme avant.
--
-- Les fonctions de déclencheur ne sont pas concernées par le risque : Postgres
-- vérifie EXECUTE à la **création** du déclencheur, pas à son déclenchement.
-- Elles sont traitées avec les autres par simplicité, et leurs droits
-- nominatifs restent en place de toute façon.
do $do$
declare
  v_fonction record;
begin
  for v_fonction in
    select p.oid::regprocedure as signature
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prokind = 'f'
  loop
    execute format('revoke execute on function %s from public', v_fonction.signature);
  end loop;
end;
$do$;

-- Et pour les fonctions à venir, sans quoi la prochaine migration rouvrirait
-- la porte en silence.
alter default privileges in schema public revoke execute on functions from public;

-- L'émetteur n'a aucune raison d'être appelable par la clé anon, qui est
-- publique. Il se contente d'y répondre par un retour immédiat, mais un droit
-- inutile est un droit à retirer. `revoke ... from public` plus haut ne le
-- couvrait pas : Postgres distingue le pseudo-rôle PUBLIC des rôles nommés.
revoke all on function public.emettre_evenement(text, jsonb) from anon;

-- Régie — M4. La commande : ce que la Régie dit au produit
-- ============================================================
-- Jusqu'ici le plan de contrôle **observait**. Cette migration lui donne la
-- parole, et c'est la moitié du projet : le canal sortant est celui qui ne
-- pose aucune question de confidentialité — il ne lit rien, il dit quelque
-- chose.
--
-- Deux objets, et une règle commune : **ce que le produit doit lire vit dans
-- `public`**, jamais dans `controle`. Une page de ScolarGest qui devrait
-- appeler la Régie pour s'afficher violerait le principe fondateur — la Régie
-- peut mourir sans conséquence. Ici elle écrit dans la base du produit, et
-- s'arrête là.
--
-- C'est pourquoi il n'y a **pas** de table `controle.evenement_global` en
-- doublon de la table publiée, contrairement à ce que le plan listait au §4.
-- Deux tables pour un même objet finissent par diverger, et la seconde
-- n'apporterait qu'un brouillon — que `publieLe` porte déjà.


-- ============================================================
-- 1. Les événements globaux
-- ============================================================
-- Début d'examens nationaux, annonce, maintenance. Lisible par toutes les
-- écoles, écrit par la seule Régie.
create table public.evenement_global_publie (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('EXAMEN_NATIONAL', 'ANNONCE', 'MAINTENANCE')),
  titre text not null check (length(btrim(titre)) between 3 and 120),
  message text not null check (length(btrim(message)) between 3 and 500),
  -- Portée. `null` = toutes les écoles. Un cycle = les écoles qui l'enseignent.
  -- Pas de ciblage par établissement : une annonce nominative n'est pas une
  -- annonce, c'est un message de support, et le produit a déjà un canal pour
  -- cela (`support_demande`).
  "cycleId" uuid references cycle(id),
  "debuteLe" timestamptz not null,
  "finitLe" timestamptz not null,
  -- Nul tant que c'est un brouillon. Rédiger et publier sont deux gestes :
  -- écrire une annonce à destination de toutes les écoles sans pouvoir la
  -- relire est précisément le genre d'erreur qu'on ne rattrape pas.
  "publieLe" timestamptz,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  constraint evenement_global_periode check ("finitLe" > "debuteLe")
);

comment on table public.evenement_global_publie is
  'Annonces de la Régie aux écoles. Écrite par le rôle regie uniquement ; lue par toutes les sessions, mais seulement une fois publiée.';

create index idx_evenement_global_fenetre
  on public.evenement_global_publie ("debuteLe", "finitLe")
  where "publieLe" is not null;

create trigger trg_evenement_global_updated
  before update on public.evenement_global_publie
  for each row execute function touch_updated_at();

alter table public.evenement_global_publie enable row level security;

-- Un brouillon n'existe pas pour les écoles. La condition est dans la policy
-- et pas seulement dans la requête du service : la clé anon est publique, et
-- une lecture qui passerait un jour à côté du service trouverait la RLS.
create policy evenement_global_lecture on public.evenement_global_publie
  for select using ("publieLe" is not null);

-- Aucune policy d'écriture pour les rôles de l'API : une école ne peut pas
-- s'annoncer à elle-même.
create policy evenement_global_regie on public.evenement_global_publie
  for all to regie using (true) with check (true);

grant select, insert, update on public.evenement_global_publie to regie;

insert into controle.frontiere_autorisee ("nomTable", mode, motif) values
  ('evenement_global_publie', 'ECRITURE',
   'Annonces de la Régie aux écoles : le canal sortant, écrit ici et lu par le produit.');


-- ============================================================
-- 2. Les drapeaux de fonctionnalité
-- ============================================================
-- Trois besoins, dans l'ordre où ils comptent :
--   - l'**interrupteur d'arrêt** : couper une fonctionnalité qui se comporte
--     mal, sans déploiement, sans attendre que quelqu'un soit disponible ;
--   - le **ciblage par école** : ouvrir à une seule d'abord ;
--   - le **pourcentage** : ouvrir progressivement.
--
-- Le drapeau vit dans `public` pour la même raison que l'annonce : c'est le
-- produit qui le lit, et il doit pouvoir le lire quand la Régie est éteinte.
create table public.drapeau (
  code text primary key check (code ~ '^[a-z][a-z0-9_]{2,40}$'),
  libelle text not null,
  -- La valeur servie quand rien d'autre ne tranche. `true` pour un drapeau
  -- posé sur une fonctionnalité **déjà livrée** : le drapeau devient alors un
  -- interrupteur d'arrêt et non une ouverture, et l'absence de décision
  -- conserve le comportement d'avant.
  "actifParDefaut" boolean not null default false,
  -- Prime sur tout le reste. Un incident se coupe d'un seul geste, sans avoir
  -- à défaire un ciblage ligne à ligne.
  arrete boolean not null default false,
  -- Déploiement progressif. 100 = tout le monde, 0 = personne sauf ciblage
  -- explicite. Le tirage est déterministe par école, sinon une même école
  -- verrait la fonctionnalité apparaître et disparaître d'une page à l'autre.
  pourcentage int not null default 100 check (pourcentage between 0 and 100),
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

comment on table public.drapeau is
  'Drapeaux de fonctionnalité, écrits par la Régie et lus par le produit. `arrete` prime sur tout : c''est l''interrupteur d''arrêt.';

create table public.drapeau_etablissement (
  code text not null references public.drapeau(code) on delete cascade,
  "etablissementId" uuid not null references etablissement(id) on delete cascade,
  actif boolean not null,
  motif text,
  "createdAt" timestamptz not null default now(),
  primary key (code, "etablissementId")
);

comment on table public.drapeau_etablissement is
  'Décision explicite pour une école. Prime sur le pourcentage, jamais sur `arrete`.';

create trigger trg_drapeau_updated
  before update on public.drapeau
  for each row execute function touch_updated_at();

alter table public.drapeau enable row level security;
alter table public.drapeau_etablissement enable row level security;

-- Le catalogue des drapeaux est lisible : il ne dit rien d'une école.
create policy drapeau_lecture on public.drapeau for select using (true);

-- Le ciblage, lui, nomme des écoles. Chacune ne voit que sa propre ligne —
-- savoir qu'une autre teste une fonctionnalité n'est l'affaire de personne.
create policy drapeau_etablissement_lecture on public.drapeau_etablissement
  for select using ("etablissementId" = auth_etablissement_id() or is_super_admin());

create policy drapeau_regie on public.drapeau for all to regie using (true) with check (true);
create policy drapeau_etablissement_regie on public.drapeau_etablissement
  for all to regie using (true) with check (true);

grant select, insert, update, delete on public.drapeau to regie;
grant select, insert, update, delete on public.drapeau_etablissement to regie;

insert into controle.frontiere_autorisee ("nomTable", mode, motif) values
  ('drapeau', 'ECRITURE',
   'Catalogue des drapeaux de fonctionnalité : la Régie les crée et les coupe.'),
  ('drapeau_etablissement', 'ECRITURE',
   'Ciblage d''un drapeau par école. Ne porte que des identifiants, aucun contenu.');

-- Le DELETE est ici légitime, contrairement au référentiel : retirer une école
-- d'un ciblage n'est pas réécrire le passé, et un drapeau abandonné doit
-- pouvoir disparaître. La contrepartie est le journal de la Régie, qui garde
-- la trace du geste. Le contrôle de frontière l'accepte sur ces deux tables
-- parce que leur mode est ECRITURE ; il refuserait un DELETE sur le
-- référentiel, dont le passé se ferme au lieu de s'effacer.


-- ============================================================
-- 3. Comment le produit lit un drapeau
-- ============================================================
-- Une fonction, et non trois requêtes côté application : l'ordre de priorité
-- est une règle métier, et une règle métier écrite à deux endroits finit par
-- diverger. Ici elle est écrite une fois, à l'endroit qui a la donnée.
--
-- **L'ordre compte, et il n'est pas discutable** :
--   1. `arrete` — un incident coupe tout, y compris un ciblage explicite.
--      Sans cette primauté, couper une fonctionnalité exigerait de défaire
--      chaque ligne de ciblage, au pire moment.
--   2. la décision explicite pour cette école ;
--   3. le pourcentage, tiré de façon **déterministe** sur l'identifiant de
--      l'école ;
--   4. la valeur par défaut du drapeau ;
--   5. et si le drapeau n'existe pas du tout : `false`, sans erreur. Un
--      drapeau inconnu ne doit jamais faire tomber une page — c'est
--      exactement le cas entre le déploiement du code et la création du
--      drapeau, fenêtre pendant laquelle le produit doit continuer de tourner.
create or replace function public.drapeau_actif(p_code text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $fn$
declare
  v_drapeau public.drapeau%rowtype;
  v_etablissement uuid;
  v_explicite boolean;
begin
  select * into v_drapeau from public.drapeau where code = p_code;
  if not found then
    return false;
  end if;

  if v_drapeau.arrete then
    return false;
  end if;

  v_etablissement := auth_etablissement_id();
  -- Hors session d'école — un SUPER_ADMIN, un outil de plateforme — il n'y a
  -- rien à cibler : le défaut du drapeau tranche.
  if v_etablissement is null then
    return v_drapeau."actifParDefaut";
  end if;

  select actif into v_explicite
    from public.drapeau_etablissement
   where code = p_code and "etablissementId" = v_etablissement;
  if found then
    return v_explicite;
  end if;

  if v_drapeau.pourcentage >= 100 then
    return true;
  end if;
  if v_drapeau.pourcentage <= 0 then
    return false;
  end if;

  -- `hashtext` sur la paire (code, école) : déterministe, et différent d'un
  -- drapeau à l'autre. Hacher l'école seule ferait que les mêmes écoles
  -- servent de cobayes à chaque déploiement progressif.
  --
  -- `abs()` sur `hashtext` : la fonction rend un entier signé, et un reste
  -- négatif ne serait jamais inférieur au pourcentage — la moitié des écoles
  -- seraient exclues quoi qu'on règle.
  return (abs(hashtext(p_code || ':' || v_etablissement::text)) % 100) < v_drapeau.pourcentage;
end;
$fn$;

comment on function public.drapeau_actif(text) is
  'Ordre : arrêt, puis décision par école, puis pourcentage déterministe, puis défaut. Un drapeau inconnu renvoie false sans lever.';

revoke all on function public.drapeau_actif(text) from public;
grant execute on function public.drapeau_actif(text) to authenticated, service_role;


-- ============================================================
-- 4. Le premier drapeau, et son consommateur
-- ============================================================
-- Un drapeau que personne ne lit est une colonne morte, et ce dépôt en a déjà
-- payé deux (`etablissement.logo`, `matiere.matiereOfficielleId`). Celui-ci a
-- un consommateur réel dès aujourd'hui : `projeterReferentielNational`, la
-- bascule d'autorité livrée le 2026-09-12.
--
-- C'est le bon premier cas parce que c'est le plus récent et le moins éprouvé :
-- si une école se retrouve avec un barème projeté qui ne lui convient pas, la
-- Régie coupe pour elle seule, en quinze secondes, sans déploiement. Sans ce
-- drapeau il faudrait livrer un correctif, donc attendre.
--
-- `actifParDefaut = true` et `pourcentage = 100` : la fonctionnalité est
-- **déjà** en service, et un drapeau qui la couperait en arrivant serait une
-- régression déguisée en outil.
insert into public.drapeau (code, libelle, "actifParDefaut", pourcentage) values
  ('referentiel_national',
   'Projection du référentiel national à la création des classes',
   true,
   100);

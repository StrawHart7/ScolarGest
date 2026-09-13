-- Régie — M5. Les erreurs : compter sans lire
-- ============================================================
-- Le produit a déjà Sentry, qui garde la trace complète d'une erreur. Cette
-- migration n'en est pas un second exemplaire, et ce serait une mauvaise idée
-- d'essayer : une trace contient des valeurs, donc du contenu d'école.
--
-- Ce que la Régie apporte que Sentry ne donne pas : **le lien avec le reste du
-- plan de contrôle**. Combien d'écoles distinctes touchées, depuis quand,
-- corrélé au flux d'événements et aux drapeaux — donc « est-ce que ça a
-- commencé quand j'ai ouvert ce drapeau ». C'est une question d'exploitation,
-- pas de débogage.
--
-- ## Ce qui n'est pas stocké, et pourquoi
--
-- **Pas le message d'erreur.** C'est le point qui a failli passer : un message
-- paraît anodin — « violation de contrainte » — jusqu'à ce qu'il cite la
-- valeur fautive, qui est un nom d'élève ou un montant. Les erreurs Supabase
-- le font systématiquement, dans `details` et `hint`. Stocker le message
-- aurait fait entrer du contenu d'école dans le plan de contrôle par la porte
-- de service, sans qu'aucune règle écrite ne soit enfreinte.
--
-- Ce qui est stocké : une empreinte, un nom de classe d'erreur, une route, un
-- code. De quoi grouper et compter, jamais de quoi lire.


create table controle.erreur (
  id bigint generated always as identity primary key,
  -- Empreinte calculée côté produit sur (nom, route, code). Deux occurrences
  -- du même défaut se rangent ensemble ; deux défauts distincts ne se
  -- confondent pas.
  empreinte text not null unique,
  nom text not null,
  route text,
  code text,
  "premiereFois" timestamptz not null default now(),
  "derniereFois" timestamptz not null default now(),
  occurrences bigint not null default 0,
  -- Nombre d'**écoles distinctes** touchées. Une erreur vue par une seule
  -- école est un cas particulier ; la même vue par douze est une panne. Sans
  -- ce compteur, une boucle de rechargement chez un seul utilisateur
  -- ressemblerait à un incident général — et l'inverse est vrai aussi.
  "ecolesTouchees" int not null default 0,
  statut text not null default 'OUVERTE' check (statut in ('OUVERTE', 'SOURDINE', 'RESOLUE')),
  -- Écrits par l'opérateur, jamais par le produit.
  titre text,
  note text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

comment on table controle.erreur is
  'Erreurs du produit, groupées par empreinte. Ne porte ni message ni trace : Sentry a le détail, la Régie a le dénombrement.';

create index idx_erreur_derniere on controle.erreur ("derniereFois" desc);
create index idx_erreur_statut on controle.erreur (statut, "derniereFois" desc);

create trigger trg_erreur_updated
  before update on controle.erreur
  for each row execute function public.touch_updated_at();

create table controle.erreur_occurrence (
  id bigint generated always as identity primary key,
  "erreurId" bigint not null references controle.erreur(id) on delete cascade,
  "survenuLe" timestamptz not null default now(),
  "etablissementId" uuid,
  role text
);

create index idx_erreur_occurrence on controle.erreur_occurrence ("erreurId", "survenuLe" desc);


-- ============================================================
-- Le signalement, côté produit
-- ============================================================
-- Même modèle que `emettre_evenement` : `SECURITY DEFINER`, l'établissement et
-- le rôle lus du JWT et jamais reçus.
--
-- **Le débit est borné en base, pas dans l'application.** Une page en boucle
-- de rechargement produit des centaines d'appels par minute, et une limite
-- posée côté client ne vaudrait rien puisque c'est justement le client qui
-- déraille. L'agrégat est toujours mis à jour — le compteur doit dire la
-- vérité — mais une ligne d'occurrence n'est écrite qu'une fois par minute et
-- par école. Le détail reste lisible et la table ne gonfle pas.
create or replace function public.signaler_erreur(
  p_empreinte text,
  p_nom text,
  p_route text default null,
  p_code text default null
)
returns void
language plpgsql
security definer
set search_path = public, controle, pg_catalog
as $fn$
declare
  v_id bigint;
  v_etablissement uuid;
begin
  if auth.uid() is null then
    return;
  end if;

  v_etablissement := auth_etablissement_id();

  -- Bornes de longueur ici plutôt qu'en contrainte : dépasser n'est pas une
  -- faute de l'utilisateur et ne doit pas faire échouer le signalement. On
  -- coupe, et la donnée reste exploitable.
  insert into controle.erreur (empreinte, nom, route, code, occurrences)
  values (left(p_empreinte, 64), left(p_nom, 120), left(p_route, 160), left(p_code, 40), 1)
  on conflict (empreinte) do update
    set occurrences = controle.erreur.occurrences + 1,
        "derniereFois" = now(),
        -- Une erreur close qui revient se rouvre. La laisser en RESOLUE
        -- effacerait de l'écran le seul signe qu'un correctif n'a pas tenu.
        -- SOURDINE, en revanche, est une décision délibérée : elle reste.
        statut = case when controle.erreur.statut = 'RESOLUE' then 'OUVERTE' else controle.erreur.statut end
  returning id into v_id;

  -- Une occurrence par minute et par école, pas davantage.
  if not exists (
    select 1 from controle.erreur_occurrence o
     where o."erreurId" = v_id
       and o."survenuLe" > now() - interval '1 minute'
       -- `is not distinct from` et non `=` : hors session d'école
       -- l'établissement est nul, et `null = null` ne vaut pas vrai — la
       -- borne de débit ne s'appliquerait jamais à ces appels-là.
       and o."etablissementId" is not distinct from v_etablissement
  ) then
    insert into controle.erreur_occurrence ("erreurId", "etablissementId", role)
    values (v_id, v_etablissement, auth_role());

    -- Le compteur d'écoles distinctes se recalcule à l'ajout d'une occurrence,
    -- et seulement là : le tenir à jour à chaque appel coûterait un `count`
    -- distinct par erreur signalée, donc précisément pendant une panne.
    update controle.erreur
       set "ecolesTouchees" = (
             select count(distinct "etablissementId")
               from controle.erreur_occurrence where "erreurId" = v_id
           )
     where id = v_id;
  end if;
end;
$fn$;

comment on function public.signaler_erreur(text, text, text, text) is
  'Signale une erreur du produit. Ni message ni trace : Sentry a le détail. Débit borné à une occurrence par minute et par école.';

revoke all on function public.signaler_erreur(text, text, text, text) from public;
revoke all on function public.signaler_erreur(text, text, text, text) from anon;
grant execute on function public.signaler_erreur(text, text, text, text) to authenticated;

-- Régie — la frontière apprend à dire « et supprimer »
-- ============================================================
-- Correctif d'une contradiction que le contrôle a trouvée dès sa première
-- exécution réelle, et c'est précisément pour ça qu'il existe.
--
-- `commande_regie` accorde `DELETE` sur `drapeau` et `drapeau_etablissement`,
-- avec un commentaire affirmant que « le contrôle de frontière l'accepte sur
-- ces deux tables parce que leur mode est ECRITURE ». **C'était faux.** La
-- branche (a) de `regie_frontiere_debordements` ne tolère que SELECT, INSERT
-- et UPDATE pour le mode ECRITURE. Le contrôle a donc rendu deux lignes :
--
--   DELETE  drapeau                 Privilège hors du contrat
--   DELETE  drapeau_etablissement   Privilège hors du contrat
--
-- ## Lequel des deux avait raison
--
-- Le contrôle. Mais pas de la façon dont on le corrigerait par réflexe : la
-- réponse n'est **ni** de retirer le `DELETE`, **ni** d'élargir le mode
-- ECRITURE à toutes les tables.
--
-- Retirer le droit serait faux sur le fond. Sortir une école d'un ciblage
-- n'est pas réécrire son passé, et un drapeau abandonné doit pouvoir
-- disparaître — sans quoi la liste se remplit de lignes que personne n'ose
-- retirer. La trace du geste vit dans le journal de la Régie, qui est
-- append-only et chaîné.
--
-- Élargir ECRITURE serait bien pire : le référentiel national est en
-- ECRITURE, et une valeur nationale erronée se **ferme** (`valableJusqua`) au
-- lieu de s'effacer. L'effacer réécrirait le passé de toutes les écoles qui
-- l'ont projetée. C'est l'invariant d'historisation du produit, et il est
-- tenu ici par un droit manquant plutôt que par une consigne — le desserrer
-- ferait perdre la garantie sur les trois tables qui comptent le plus.
--
-- Il fallait donc un **troisième mode**, et non un assouplissement du second.
-- Le vocabulaire de la frontière était trop pauvre pour dire ce qu'on voulait
-- dire ; c'est le vocabulaire qu'on corrige.


alter table controle.frontiere_autorisee
  drop constraint frontiere_autorisee_mode_check;

alter table controle.frontiere_autorisee
  add constraint frontiere_autorisee_mode_check
    check (mode in ('LECTURE', 'ECRITURE', 'ECRITURE_SUPPRESSION'));

comment on column controle.frontiere_autorisee.mode is
  'LECTURE = SELECT seul. ECRITURE = SELECT, INSERT, UPDATE — jamais DELETE, parce qu''une donnée que le produit historise se ferme au lieu de s''effacer. ECRITURE_SUPPRESSION = la suppression est en plus autorisée : réservé aux tables de réglage courant, dont la trace vit dans le journal de la Régie.';

update controle.frontiere_autorisee
   set mode = 'ECRITURE_SUPPRESSION',
       motif = 'Catalogue des drapeaux : la Régie les crée, les coupe, et retire ceux qu''elle abandonne.'
 where "nomTable" = 'drapeau';

update controle.frontiere_autorisee
   set mode = 'ECRITURE_SUPPRESSION',
       motif = 'Ciblage d''un drapeau par école. Réglage courant, pas un historique : retirer une école du ciblage est le geste normal.'
 where "nomTable" = 'drapeau_etablissement';


-- ============================================================
-- Le contrôle, remis d'accord avec le contrat
-- ============================================================
-- Seule la branche (a) change : elle connaît désormais trois modes au lieu de
-- deux. Les branches (b) à (g) sont reprises **à l'identique** — les
-- réécrire au passage aurait mêlé une correction à une refonte, et rendu le
-- diff illisible pour la seule partie qui compte.
create or replace function public.regie_frontiere_debordements()
returns table (objet text, privilege text, constat text)
language plpgsql
stable
security definer
set search_path = public, controle, pg_catalog
as $fn$
begin
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
      when f.mode = 'ECRITURE' and p.priv = 'DELETE'
        then 'DELETE sur une table déclarée en ECRITURE : une donnée historisée se ferme, elle ne s''efface pas'
      else 'Privilège hors du contrat'
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
      -- `TRUNCATE` reste hors contrat même ici : il ne journalise rien, ne
      -- déclenche aucun trigger par ligne, et vide une table entière d'un
      -- geste. Rien dans la Régie n'en a besoin.
      or (f.mode = 'ECRITURE_SUPPRESSION' and p.priv not in ('SELECT', 'INSERT', 'UPDATE', 'DELETE'))
    )

  union all

  -- (b) Schémas atteignables hors des deux prévus.
  select
    'schema ' || n.nspname,
    'USAGE',
    'Schéma atteignable par la Régie hors de controle et public'
  from pg_namespace n
  where n.nspname not in ('controle', 'public', 'pg_catalog', 'information_schema')
    and n.nspname not like 'pg_%'
    and has_schema_privilege('regie', n.oid, 'USAGE')

  union all

  -- (c) Appartenance à un autre rôle.
  select
    'role ' || r.rolname,
    'MEMBER',
    'La Régie est membre d''un autre rôle : ses droits ne sont plus ceux écrits ici'
  from pg_auth_members m
  join pg_roles r on r.oid = m.roleid
  join pg_roles g on g.oid = m.member
  where g.rolname = 'regie'

  union all

  -- (d) Fonctions de `public` exécutables par la Régie.
  select
    'function ' || p.proname,
    'EXECUTE',
    'Fonction de public exécutable par la Régie : un SECURITY DEFINER contournerait toute la frontière'
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and has_function_privilege('regie', p.oid, 'EXECUTE')

  union all

  -- (e) Les contrôles positifs.
  select 'contrôle positif ' || f."nomTable", 'SELECT',
         'Droit déclaré dans la frontière mais absent en base : la Régie ne peut pas faire son travail'
  from controle.frontiere_autorisee f
  where to_regclass('public.' || quote_ident(f."nomTable")) is not null
    and not has_table_privilege('regie', ('public.' || quote_ident(f."nomTable"))::regclass, 'SELECT')

  union all

  select 'contrôle positif ' || f."nomTable", 'UPDATE',
         'Table déclarée en ECRITURE mais non modifiable par la Régie'
  from controle.frontiere_autorisee f
  where f.mode in ('ECRITURE', 'ECRITURE_SUPPRESSION')
    and to_regclass('public.' || quote_ident(f."nomTable")) is not null
    and not has_table_privilege('regie', ('public.' || quote_ident(f."nomTable"))::regclass, 'UPDATE')

  union all

  -- (f) La frontière ne doit pas nommer une table qui n'existe pas.
  select 'frontière ' || f."nomTable", 'INTROUVABLE',
         'controle.frontiere_autorisee nomme une table absente de public'
  from controle.frontiere_autorisee f
  where to_regclass('public.' || quote_ident(f."nomTable")) is null

  union all

  -- (g) Le droit ne suffit pas quand la RLS est active : il faut une policy.
  select 'policy manquante ' || f."nomTable", 'RLS',
         'Table en écriture avec RLS active mais aucune policy pour le rôle regie : les écritures seront filtrées en silence'
  from controle.frontiere_autorisee f
  join pg_class c on c.oid = to_regclass('public.' || quote_ident(f."nomTable"))
  where f.mode in ('ECRITURE', 'ECRITURE_SUPPRESSION')
    and c.relrowsecurity
    and not exists (
      select 1 from pg_policy p
      where p.polrelid = c.oid
        and p.polcmd in ('*', 'a', 'w')
        and (select oid from pg_roles where rolname = 'regie') = any(p.polroles)
    );
end;
$fn$;

-- `create or replace` remet les droits par défaut de Supabase sur la fonction,
-- qui accorde `anon` et `authenticated`. Les retirer de nouveau : le résultat
-- ne dit rien d'une école mais tout de la plateforme, et la branche (d)
-- signalerait la fonction si `regie` pouvait l'appeler.
revoke all on function public.regie_frontiere_debordements() from public;
revoke all on function public.regie_frontiere_debordements() from anon, authenticated;
grant execute on function public.regie_frontiere_debordements() to service_role;


-- ============================================================
-- Et on vérifie que le contrôle est redevenu muet
-- ============================================================
-- Une migration qui corrige un contrôle doit le rejouer, sinon elle se
-- contente d'espérer. Le bloc échoue et annule tout si une ligne subsiste.
do $do$
declare
  v_lignes int;
  v_premier text;
begin
  select count(*), min(objet || ' / ' || privilege || ' : ' || constat)
    into v_lignes, v_premier
    from public.regie_frontiere_debordements();

  if v_lignes > 0 then
    raise exception 'La frontière rend encore % ligne(s). Première : %', v_lignes, v_premier;
  end if;

  raise notice 'Frontière Régie : aucun débordement, contrôles positifs passés.';
end;
$do$;

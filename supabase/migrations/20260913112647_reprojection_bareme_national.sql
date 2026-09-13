-- Régie — H6. Une correction nationale atteint les écoles
-- ============================================================
-- Dernière pièce du plan de contrôle, et la seule qui traverse la frontière
-- dans le sens difficile : la Régie corrige une valeur du barème national, et
-- cette correction doit atteindre les coefficients des écoles.
--
-- Jusqu'ici elle ne les atteignait pas. `projeterReferentielNational` lit le
-- barème **au moment où l'école projette**, et rien ne rejoue cette lecture.
-- Une école ayant projeté en septembre gardait donc indéfiniment la valeur
-- fautive, tout en étant marquée `referentielNational = true` : le produit
-- affirmait suivre un référentiel qu'il ne suivait plus.
--
--
-- ## Pourquoi un déclencheur, et non un appel de la Régie
--
-- Le réflexe serait d'exposer `reprojeter(...)` et de laisser la Régie
-- l'appeler après sa correction. Trois raisons de ne pas le faire, et la
-- troisième est structurelle :
--
-- 1. **La Régie n'a aucun droit sur `coefficient_matiere`**, et ne doit pas en
--    gagner : ce sont les coefficients d'une école, donc du contenu.
-- 2. **La branche (d) de `regie_frontiere_debordements` refuse** qu'une
--    fonction de `public` soit exécutable par la Régie — un `SECURITY DEFINER`
--    appelable contournerait toute la frontière. Lui ouvrir une exception
--    reviendrait à percer le contrôle pour y faire passer précisément ce
--    contre quoi il protège.
-- 3. **La propagation n'est pas un geste de la Régie** : c'est une
--    **conséquence** de l'écriture qu'elle a le droit de faire. Écrite comme
--    conséquence, elle vaut pour n'importe quel auteur — la Régie, une
--    migration, un script de plateforme — et elle vit dans la même transaction
--    que la correction. Les deux aboutissent ou aucune des deux, ce qu'un
--    appel séparé ne peut pas garantir.
--
--
-- ## Ce qui n'est jamais réécrit
--
-- **Une année clôturée.** C'est l'invariant d'historisation du produit : ses
-- bulletins ont été émis avec un barème donné, et le réécrire ferait diverger
-- un document déjà remis aux familles de sa source. Même refus que
-- `projeterReferentielNational`.
--
-- **Une ligne `LOCAL`.** Projeter est une décision de l'école — elle adopte le
-- barème national, et `ecrireProjection` convertit alors ses lignes locales.
-- Reprojeter n'est pas cette décision : c'est une correction qui suit son
-- lignage. Elle ne touche donc que ce que la plateforme possède déjà, et une
-- cellule laissée locale le reste. Confondre les deux ferait qu'une correction
-- de barème adopterait, au passage, des cellules que l'école avait gardées.
--
--
-- ## Le cas qui a décidé de l'ordre des opérations
--
-- `corrigerCoefficient` fait deux écritures : elle **ferme** la ligne en
-- vigueur (`valableJusqua`), puis en **ouvre** une nouvelle. Le déclencheur
-- part donc deux fois.
--
-- Au premier départ, la nouvelle ligne n'existe pas encore : pour une année
-- scolaire postérieure à la fermeture, plus aucune ligne n'est en vigueur, et
-- la reprojection ne trouve rien à écrire. Elle ne fait rien — surtout pas
-- effacer. Au second départ, la nouvelle ligne est là et la reprojection
-- aboutit. L'état intermédiaire est invisible : tout est dans la même
-- transaction.
--
-- Conséquence à garder : **fermer une ligne sans en ouvrir une autre ne
-- réécrit rien.** Les écoles gardent la dernière valeur connue plutôt que de
-- perdre leur coefficient. C'est le bon défaut — un coefficient absent vaut
-- zéro dans le moteur de moyennes et retirerait la matière du bulletin.


-- ============================================================
-- 1. La trace, côté plan de contrôle
-- ============================================================
-- Sans elle, la propagation serait un mécanisme silencieux de plus, et
-- l'opérateur corrigerait un barème sans jamais savoir si sa correction a
-- touché quoi que ce soit. C'est la leçon des deux écrans muets, réglés le
-- matin même : un mécanisme qu'on ne peut pas observer finit par être cru sur
-- parole.
--
-- Aucune clé étrangère vers `public`, comme partout dans `controle` : la trace
-- doit survivre à la disparition de son sujet, et le produit doit pouvoir
-- vivre sans ce schéma.
create table controle.reprojection (
  id bigint generated always as identity primary key,
  -- Nulle pour un balayage complet, déclenché à la main ou par une migration.
  "coefficientOfficielId" uuid,
  "matiereOfficielleId" uuid,
  "niveauId" uuid,
  "serieId" uuid,
  -- Lignes de coefficient réécrites chez les écoles.
  lignes int not null,
  -- Années scolaires distinctes touchées. Le couple des deux chiffres dit
  -- l'ampleur : 400 lignes sur 2 années n'est pas 400 lignes sur 200 années.
  "anneesTouchees" int not null,
  "survenuLe" timestamptz not null default now()
);

comment on table controle.reprojection is
  'Effet constaté d''une correction du barème national sur les coefficients des écoles. Ne nomme aucune école : des identifiants de référentiel et deux dénombrements.';

create index idx_reprojection_recente on controle.reprojection ("survenuLe" desc);

grant select on controle.reprojection to regie;


-- ============================================================
-- 2. La reprojection
-- ============================================================
-- Un seul paramètre, et c'est délibéré. La version portée par trois arguments
-- (matière, niveau, série) était inutilisable : `serieId` est nul au collège,
-- et rien ne distingue alors « la série est nulle » de « pas de filtre sur la
-- série ». Le déclencheur passe donc l'identifiant de la ligne qui a changé,
-- et la fonction en déduit la portée. Nul = balayage complet.
--
-- Idempotente : la condition de fin ne retient que les lignes réellement
-- différentes, donc réappliquer ne réécrit rien et ne journalise rien.
create or replace function public.reprojeter_bareme_national(p_declencheur uuid default null)
returns int
language plpgsql
security definer
set search_path = public, controle, pg_catalog
as $fn$
declare
  v_cible boolean := p_declencheur is not null;
  v_matiere uuid;
  v_niveau uuid;
  v_serie uuid;
  v_lignes int := 0;
  v_annees int := 0;
begin
  if v_cible then
    select "matiereOfficielleId", "niveauId", "serieId"
      into v_matiere, v_niveau, v_serie
      from coefficient_officiel
     where id = p_declencheur;
    -- La ligne a disparu entre-temps : rien à propager, et surtout pas une
    -- erreur. Une reprojection ne doit jamais faire échouer l'écriture qui
    -- l'a déclenchée.
    if not found then
      return 0;
    end if;
  end if;

  with a_reecrire as (
    select cm.id as ligne,
           cm."anneeScolaireId" as annee_id,
           o.id as officiel,
           o.coefficient::double precision as valeur,
           o.confiance as confiance
      from coefficient_matiere cm
      join coefficient_officiel ancien on ancien.id = cm."coefficientOfficielId"
      join annee_scolaire a on a.id = cm."anneeScolaireId"
      join lateral (
        select co.id, co.coefficient, co.confiance
          from coefficient_officiel co
         where co."matiereOfficielleId" = ancien."matiereOfficielleId"
           and co."niveauId" = ancien."niveauId"
           and co."serieId" is not distinct from ancien."serieId"
           -- La borne haute est **exclue** : une ligne close en 2027 vaut
           -- encore pour 2026-2027 et cesse de valoir à la rentrée 2027.
           -- Même règle que `baremeEnVigueur` côté produit ; les deux doivent
           -- dire la même chose, sans quoi projeter et reprojeter donneraient
           -- deux valeurs différentes pour la même année.
           and co."valableDe" <= extract(year from a."dateDebut")::int
           and (co."valableJusqua" is null
                or co."valableJusqua" > extract(year from a."dateDebut")::int)
         -- Ordre **total**. `valableDe` décroissant désigne la version la plus
         -- récemment ouverte ; `id` tranche si deux la partagent. Sans le
         -- second critère, la même entrée pourrait donner deux réponses d'une
         -- exécution à l'autre — le défaut exact qui a fait afficher des zéros
         -- crédibles dans `mv_sante_ecole` la veille.
         order by co."valableDe" desc, co.id
         limit 1
      ) o on true
     where cm.origine <> 'LOCAL'
       and a.statut <> 'TERMINEE'
       and (not v_cible
            or (ancien."matiereOfficielleId" = v_matiere
                and ancien."niveauId" = v_niveau
                and ancien."serieId" is not distinct from v_serie))
       and (cm.coefficient is distinct from o.coefficient::double precision
            or cm.origine is distinct from o.confiance
            or cm."coefficientOfficielId" is distinct from o.id)
  ),
  ecrites as (
    update coefficient_matiere cm
       set coefficient = r.valeur,
           origine = r.confiance,
           "coefficientOfficielId" = r.officiel
      from a_reecrire r
     where cm.id = r.ligne
    returning r.annee_id as annee_id
  )
  select count(*)::int, count(distinct annee_id)::int
    into v_lignes, v_annees
    from ecrites;

  if v_lignes > 0 then
    insert into controle.reprojection
      ("coefficientOfficielId", "matiereOfficielleId", "niveauId", "serieId", lignes, "anneesTouchees")
    values (p_declencheur, v_matiere, v_niveau, v_serie, v_lignes, v_annees);
  end if;

  return v_lignes;
end;
$fn$;

comment on function public.reprojeter_bareme_national(uuid) is
  'Réécrit les coefficients d''école issus du barème national, pour les seules années non clôturées. Nul en argument = balayage complet. Ne touche jamais une ligne LOCAL.';

-- Réservée à la plateforme. La Régie ne l'appelle pas — elle n'a pas à
-- l'appeler, le déclencheur s'en charge — et la branche (d) du contrôle de
-- frontière signalerait ce droit si elle l'obtenait.
revoke all on function public.reprojeter_bareme_national(uuid) from public;
revoke all on function public.reprojeter_bareme_national(uuid) from anon, authenticated;
grant execute on function public.reprojeter_bareme_national(uuid) to service_role;


-- ============================================================
-- 3. Le déclencheur
-- ============================================================
-- `update of` restreint les colonnes qui réveillent la propagation. Sans cette
-- liste, corriger la seule `source` d'une ligne — un ajout de référence
-- documentaire, qui ne change aucune valeur — ferait tourner la reprojection
-- pour rien.
--
-- `confiance` **y figure** : la ratification d'un candidat fait passer les
-- écoles de `CONVERGENT` à `OFFICIEL` sans changer un seul coefficient. Aucun
-- bulletin ne bouge, mais ce que le produit dit de la provenance de ses
-- chiffres devient juste.
create or replace function public.fn_reprojeter_bareme()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $fn$
begin
  perform public.reprojeter_bareme_national(new.id);
  return null;
end;
$fn$;

create trigger trg_reprojeter_bareme
  after insert or update of coefficient, confiance, "valableDe", "valableJusqua"
  on public.coefficient_officiel
  for each row execute function public.fn_reprojeter_bareme();


-- ============================================================
-- 4. Les fonctions de `controle` deviennent une liste, pas un état
-- ============================================================
-- Trou trouvé en écrivant cette migration, et il valait la peine de s'arrêter.
--
-- La branche (d) du contrôle de frontière ne regarde que les fonctions de
-- `public`. Or **toute fonction nouvelle accorde `EXECUTE` à `PUBLIC`**, et
-- `regie` est membre de `PUBLIC` — c'est exactement le défaut corrigé en M0
-- pour le schéma `public`, jamais fermé pour `controle`. Les quatre fonctions
-- qui y vivent aujourd'hui sont donc toutes appelables par la Régie, et rien
-- ne le signalait.
--
-- Aucune des quatre n'est dangereuse : deux sont des fonctions de déclencheur
-- (inappelables directement), une sert une contrainte `CHECK`, la dernière est
-- délibérément accordée. Le défaut n'est pas là : il est qu'on ne l'apprenne
-- qu'en lisant `pg_proc`. Le jour où quelqu'un ajoute ici un `SECURITY
-- DEFINER` qui écrit, la Régie l'obtiendra sans que personne ne le décide.
--
-- La réponse est celle du reste du système : ce qui est autorisé se déclare en
-- **donnée**, et le contrôle compare. Plutôt que de révoquer — ce qui ne
-- changerait rien, les quatre portant déjà une autorisation nominative — on
-- rend l'état visible et on fait échouer le contrôle sur tout ajout non
-- déclaré.
create table controle.fonction_autorisee (
  nom text primary key,
  motif text not null check (length(btrim(motif)) >= 20),
  "createdAt" timestamptz not null default now()
);

comment on table controle.fonction_autorisee is
  'Fonctions de `controle` que la Régie a le droit d''exécuter. Toute autre fonction exécutable par elle fait échouer la branche (h) du contrôle de frontière.';

insert into controle.fonction_autorisee (nom, motif) values
  ('rafraichir_agregats',
   'Recalcul des vues matérialisées de santé et de revenu, déclenché depuis le cockpit. Seul appel délibérément accordé.'),
  ('meta_sans_contenu',
   'Prédicat de la contrainte CHECK sur les métadonnées d''événement. Ne lit rien et n''écrit rien : elle valide un jsonb qu''on lui passe.'),
  ('fn_chainer_journal',
   'Fonction de déclencheur du journal chaîné. Une fonction trigger ne s''appelle pas directement : PostgreSQL refuse un appel hors contexte.'),
  ('fn_journal_immuable',
   'Fonction de déclencheur interdisant la modification du journal. Même remarque : inappelable hors du contexte d''un déclencheur.');

grant select on controle.fonction_autorisee to regie;


-- ============================================================
-- 5. Le contrôle de frontière apprend à regarder `controle`
-- ============================================================
-- Les branches (a) à (g) sont reprises **à l'identique**. Seule (h) est
-- nouvelle — mêler une refonte à un ajout rendrait le diff illisible sur la
-- seule partie qui compte.
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
    )

  union all

  -- (h) Fonctions de `controle` exécutables par la Régie sans déclaration.
  --
  -- `PUBLIC` reçoit `EXECUTE` sur toute fonction nouvelle, et la Régie est
  -- membre de `PUBLIC` : sans cette branche, il suffit d'ajouter une fonction
  -- ici pour la lui donner, en silence.
  select 'function controle.' || p.proname, 'EXECUTE',
         'Fonction de controle exécutable par la Régie sans figurer dans controle.fonction_autorisee'
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'controle'
    and has_function_privilege('regie', p.oid, 'EXECUTE')
    and not exists (
      select 1 from controle.fonction_autorisee a where a.nom = p.proname
    );
end;
$fn$;

revoke all on function public.regie_frontiere_debordements() from public;
revoke all on function public.regie_frontiere_debordements() from anon, authenticated;
grant execute on function public.regie_frontiere_debordements() to service_role;


-- ============================================================
-- 6. On rejoue le contrôle, et on éprouve la reprojection
-- ============================================================
-- Une migration qui installe un mécanisme doit l'éprouver, sinon elle se
-- contente d'espérer. Ce bloc fait les deux : il vérifie que la frontière est
-- restée muette, puis il **provoque une correction**, constate ce qu'elle a
-- réécrit, et défait tout. Rien de ce qu'il écrit ne subsiste.
do $do$
declare
  v_lignes int;
  v_premier text;
  v_temoin record;
  v_avant double precision;
  v_apres double precision;
  v_traces int;
  v_nouvelle uuid;
begin
  -- --- La frontière, d'abord ------------------------------------------------
  select count(*), min(objet || ' / ' || privilege || ' : ' || constat)
    into v_lignes, v_premier
    from public.regie_frontiere_debordements();
  if v_lignes > 0 then
    raise exception 'La frontière rend % ligne(s). Première : %', v_lignes, v_premier;
  end if;

  -- --- Un balayage complet ne doit rien changer -----------------------------
  -- Les écoles ont été projetées depuis ce même barème : si ce balayage
  -- réécrivait quoi que ce soit, c'est que reprojeter et projeter ne disent
  -- pas la même chose, et l'un des deux serait faux.
  v_lignes := public.reprojeter_bareme_national();
  if v_lignes <> 0 then
    raise exception
      'Le balayage initial a réécrit % ligne(s) : reprojeter et projeter divergent, il faut trancher avant d''installer le déclencheur.',
      v_lignes;
  end if;

  -- --- Puis l'épreuve réelle ------------------------------------------------
  -- On prend une ligne d'école réellement issue du barème, on corrige la
  -- valeur nationale dont elle vient, et on regarde si elle a suivi.
  --
  -- `annee > valableDe` n'est pas un détail de confort : la correction s'ouvre
  -- à l'année de l'école, et la contrainte `valableJusqua > valableDe` interdit
  -- de fermer une ligne à son propre millésime. Sans cette condition, un
  -- témoin dont l'année scolaire vaut exactement `valableDe` ferait échouer
  -- l'épreuve — ou pire, la ferait réussir pour une mauvaise raison.
  select cm.id as ligne_id,
         cm.coefficient as valeur,
         cm."coefficientOfficielId" as officiel_id,
         co."matiereOfficielleId" as matiere_id,
         co."niveauId" as niveau_id,
         co."serieId" as serie_id,
         co."valableDe" as valable_de,
         co.confiance as confiance,
         extract(year from a."dateDebut")::int as annee
    into v_temoin
    from coefficient_matiere cm
    join coefficient_officiel co on co.id = cm."coefficientOfficielId"
    join annee_scolaire a on a.id = cm."anneeScolaireId"
   where cm.origine <> 'LOCAL'
     and a.statut <> 'TERMINEE'
     and co."valableJusqua" is null
     and extract(year from a."dateDebut")::int > co."valableDe"
   limit 1;

  if not found then
    raise notice 'Reprojection installée, mais non éprouvée : aucune ligne d''école issue du barème national sur une année ouverte.';
    return;
  end if;

  v_avant := v_temoin.valeur;

  -- Le geste exact de `corrigerCoefficient` : fermer, puis ouvrir, à l'année
  -- scolaire du témoin — donc une correction qui **doit** l'atteindre.
  update coefficient_officiel
     set "valableJusqua" = v_temoin.annee
   where id = v_temoin.officiel_id;

  insert into coefficient_officiel
    ("matiereOfficielleId", "niveauId", "serieId", coefficient, "valableDe", confiance, source)
  values (v_temoin.matiere_id, v_temoin.niveau_id, v_temoin.serie_id,
          v_avant + 1, v_temoin.annee, v_temoin.confiance,
          'Epreuve de migration, annulee')
  returning id into v_nouvelle;

  select coefficient into v_apres from coefficient_matiere where id = v_temoin.ligne_id;
  select count(*)::int into v_traces
    from controle.reprojection where "coefficientOfficielId" = v_nouvelle;

  if v_apres is distinct from v_avant + 1 then
    raise exception
      'La reprojection n''a pas suivi : le coefficient d''école vaut % au lieu de %.',
      v_apres, v_avant + 1;
  end if;
  if v_traces = 0 then
    raise exception 'La reprojection a écrit sans laisser de trace dans controle.reprojection.';
  end if;

  raise notice 'Reprojection éprouvée : % est devenu % chez l''école, et la trace est écrite.',
    v_avant, v_apres;

  -- --- Et on défait tout ----------------------------------------------------
  -- L'ordre est contraint par une clé étrangère. `coefficient_matiere` pointe
  -- vers `coefficient_officiel` **sans cascade** : tant qu'une école référence
  -- la ligne d'épreuve, sa suppression échoue — et ferait échouer la migration
  -- entière. Il faut donc d'abord faire repointer les écoles, puis supprimer.
  --
  -- Repointer ne se fait pas en fermant la ligne d'épreuve : la contrainte
  -- `valableJusqua > valableDe` interdit de la fermer à son propre millésime,
  -- donc toute fermeture légale la laisserait en vigueur pour l'année du
  -- témoin. On la **repousse** au millésime suivant, ce qui la sort de la
  -- fenêtre et rend l'ancienne ligne à nouveau la mieux placée.
  update coefficient_officiel set "valableJusqua" = null where id = v_temoin.officiel_id;
  update coefficient_officiel set "valableDe" = v_temoin.annee + 1 where id = v_nouvelle;

  select coefficient into v_apres from coefficient_matiere where id = v_temoin.ligne_id;
  if v_apres is distinct from v_avant then
    raise exception
      'Le retour en arrière a échoué : le coefficient d''école vaut % au lieu de %. Ne pas appliquer.',
      v_apres, v_avant;
  end if;

  -- La suppression est maintenant possible : plus aucune école ne la
  -- référence. Si elle échouait malgré tout, la migration s'arrêterait ici —
  -- ce qui est le bon comportement, puisque cela signifierait que le
  -- repointage n'a pas eu lieu.
  delete from coefficient_officiel where id = v_nouvelle;
  delete from controle.reprojection where "coefficientOfficielId" = v_nouvelle;

  raise notice 'Epreuve annulée : le coefficient est revenu à %.', v_avant;
end;
$do$;

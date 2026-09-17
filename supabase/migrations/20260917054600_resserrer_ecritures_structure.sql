-- ============================================================================
-- Une garde ne peut pas interroger une table que le garde ecrit.
--
-- Le 2026-09-11, les tables qui portent de l'argent et des notes ont recu des
-- politiques qui nomment les roles, et `note` exige desormais que l'enseignant
-- soit affecte a la classe et a la matiere. Cette affectation se lit dans
-- `affectation_enseignant`, dont la politique ne regardait que l'etablissement.
--
-- Constate le 2026-09-17 par le chemin reel, client anon plus session
-- d'enseignant (`scripts/verifier-escalade-roles.ts`) : onze essais sur douze
-- ont abouti. Le premier suffit a expliquer les autres —
--
--   1. l'enseignant insere sa propre ligne dans `affectation_enseignant` ;
--   2. `est_affecte()` rend alors `true` ;
--   3. il ecrit notes et evaluations dans n'importe quelle classe de l'ecole.
--
-- La correction du 11 tenait donc par une table que l'attaquant pouvait
-- ecrire. Ce n'est pas une garde, c'est une formalite.
--
-- Les autres essais disaient la meme chose sous d'autres formes : renommer les
-- classes, terminer l'annee scolaire de l'ecole, porter un coefficient a 99 —
-- donc reecrire toutes les moyennes de la matiere —, poser un filigrane sur
-- les bulletins remis aux familles, reecrire la fiche d'un collegue.
--
-- ## Ce qui decide des roles ici
--
-- Les listes ci-dessous ne sont pas choisies : elles sont **relevees** dans
-- `src/lib/permissions/__tests__/matrice.instantane.txt`, c'est-a-dire dans les
-- `requireRole` des services qui ecrivent reellement ces tables. Resserrer plus
-- fermerait un ecran a un role legitime ; resserrer moins ne fermerait rien.
--
-- ## La lecture ne bouge pas
--
-- Un enseignant doit continuer de lire les classes, les matieres, le programme
-- et l'emploi du temps : c'est son metier. Seule l'ecriture est nommee. C'est
-- aussi pourquoi on ne peut pas se contenter d'une politique `for all` avec des
-- roles — elle fermerait la lecture du meme geste.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Les tables de structure portant directement `etablissementId`
-- ----------------------------------------------------------------------------
do $$
declare
  cible record;
  ancienne record;
  roles_sql text;
begin
  for cible in
    select * from (values
      -- Table                       Roles autorises a ECRIRE
      ('classe',                     array['DIRECTEUR']),
      ('annee_scolaire',             array['DIRECTEUR','SECRETAIRE']),
      ('matiere',                    array['DIRECTEUR','SECRETAIRE']),
      ('enseignant',                 array['DIRECTEUR','SECRETAIRE']),
      ('affectation_enseignant',     array['DIRECTEUR','SECRETAIRE']),
      ('programme_etablissement',    array['DIRECTEUR','SECRETAIRE']),
      ('emploi_du_temps_creneau',    array['DIRECTEUR','SECRETAIRE']),
      ('parametres_document',        array['DIRECTEUR']),
      ('cycle_etablissement',        array['DIRECTEUR']),
      ('onboarding_progression',     array['DIRECTEUR','SECRETAIRE','COMPTABLE']),
      ('document',                   array['DIRECTEUR','SECRETAIRE','COMPTABLE'])
    ) as v(nom, roles)
  loop
    -- Les anciennes politiques ne portent pas toutes le meme nom
    -- (`emploi_du_temps_tenant` et non `emploi_du_temps_creneau_tenant`) :
    -- on les releve plutot que de les deviner.
    for ancienne in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = cible.nom
    loop
      execute format('drop policy %I on public.%I', ancienne.policyname, cible.nom);
    end loop;

    roles_sql := format('auth_role() = any (array[%s])',
      (select string_agg(quote_literal(r), ', ') from unnest(cible.roles) as r));

    execute format($f$
      create policy %I on public.%I for select
        using (is_super_admin() or "etablissementId" = auth_etablissement_id())
    $f$, cible.nom || '_lecture', cible.nom);

    execute format($f$
      create policy %I on public.%I for insert
        with check (is_super_admin() or ("etablissementId" = auth_etablissement_id() and %s))
    $f$, cible.nom || '_insertion', cible.nom, roles_sql);

    execute format($f$
      create policy %I on public.%I for update
        using (is_super_admin() or ("etablissementId" = auth_etablissement_id() and %s))
        with check (is_super_admin() or ("etablissementId" = auth_etablissement_id() and %s))
    $f$, cible.nom || '_modification', cible.nom, roles_sql, roles_sql);

    execute format($f$
      create policy %I on public.%I for delete
        using (is_super_admin() or ("etablissementId" = auth_etablissement_id() and %s))
    $f$, cible.nom || '_suppression', cible.nom, roles_sql);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 2. Les tables rattachees par un parent
--
-- `coefficient_matiere` n'a pas d'`etablissementId` : elle se rattache par son
-- programme. C'est la table la plus sensible de cette migration — un
-- coefficient decide de chaque moyenne, et un coefficient absent retire la
-- matiere du bulletin (`calcul-moyennes:81`).
-- ----------------------------------------------------------------------------
drop policy if exists coefficient_matiere_tenant on public.coefficient_matiere;

create policy coefficient_matiere_lecture on public.coefficient_matiere for select
  using (
    is_super_admin() or exists (
      select 1 from programme_etablissement p
      where p.id = coefficient_matiere."programmeEtablissementId"
        and p."etablissementId" = auth_etablissement_id()
    )
  );

create policy coefficient_matiere_insertion on public.coefficient_matiere for insert
  with check (
    is_super_admin() or (
      auth_role() = any (array['DIRECTEUR', 'SECRETAIRE'])
      and exists (
        select 1 from programme_etablissement p
        where p.id = coefficient_matiere."programmeEtablissementId"
          and p."etablissementId" = auth_etablissement_id()
      )
    )
  );

create policy coefficient_matiere_modification on public.coefficient_matiere for update
  using (
    is_super_admin() or (
      auth_role() = any (array['DIRECTEUR', 'SECRETAIRE'])
      and exists (
        select 1 from programme_etablissement p
        where p.id = coefficient_matiere."programmeEtablissementId"
          and p."etablissementId" = auth_etablissement_id()
      )
    )
  )
  with check (
    is_super_admin() or (
      auth_role() = any (array['DIRECTEUR', 'SECRETAIRE'])
      and exists (
        select 1 from programme_etablissement p
        where p.id = coefficient_matiere."programmeEtablissementId"
          and p."etablissementId" = auth_etablissement_id()
      )
    )
  );

create policy coefficient_matiere_suppression on public.coefficient_matiere for delete
  using (
    is_super_admin() or (
      auth_role() = any (array['DIRECTEUR', 'SECRETAIRE'])
      and exists (
        select 1 from programme_etablissement p
        where p.id = coefficient_matiere."programmeEtablissementId"
          and p."etablissementId" = auth_etablissement_id()
      )
    )
  );

drop policy if exists titularite_classe_tenant on public.titularite_classe;

create policy titularite_classe_lecture on public.titularite_classe for select
  using (
    is_super_admin() or exists (
      select 1 from classe c
      where c.id = titularite_classe."classeId"
        and c."etablissementId" = auth_etablissement_id()
    )
  );

create policy titularite_classe_ecriture on public.titularite_classe for all
  using (
    is_super_admin() or (
      auth_role() = any (array['DIRECTEUR', 'SECRETAIRE'])
      and exists (
        select 1 from classe c
        where c.id = titularite_classe."classeId"
          and c."etablissementId" = auth_etablissement_id()
      )
    )
  )
  with check (
    is_super_admin() or (
      auth_role() = any (array['DIRECTEUR', 'SECRETAIRE'])
      and exists (
        select 1 from classe c
        where c.id = titularite_classe."classeId"
          and c."etablissementId" = auth_etablissement_id()
      )
    )
  );

-- ----------------------------------------------------------------------------
-- 3. L'etablissement lui-meme
--
-- La politique etait `for all` : n'importe quel compte de l'ecole pouvait
-- reecrire la ligne de son etablissement. `fn_proteger_facturation` couvrait
-- les dates d'essai et la suspension — rien d'autre. Le nom, l'adresse et le
-- contact partaient librement.
--
-- Creation et suppression restent au SUPER_ADMIN : une ecole ne se cree pas
-- elle-meme, et `createEtablissement` est deja garde ainsi.
-- ----------------------------------------------------------------------------
drop policy if exists etablissement_tenant on public.etablissement;

create policy etablissement_lecture on public.etablissement for select
  using (is_super_admin() or id = auth_etablissement_id());

create policy etablissement_modification on public.etablissement for update
  using (is_super_admin() or (id = auth_etablissement_id() and auth_role() = 'DIRECTEUR'))
  with check (is_super_admin() or (id = auth_etablissement_id() and auth_role() = 'DIRECTEUR'));

create policy etablissement_creation on public.etablissement for insert
  with check (is_super_admin());

create policy etablissement_suppression on public.etablissement for delete
  using (is_super_admin());

-- ----------------------------------------------------------------------------
-- 4. Le journal d'audit ne se signe pas du nom d'un autre
--
-- La politique d'insertion ne verifiait que l'etablissement : n'importe quel
-- compte pouvait deposer une ligne au nom du Directeur. Un journal dans lequel
-- on ecrit ce qu'on veut, sous le nom qu'on veut, n'est pas un journal — c'est
-- exactement la trace qu'on consultera le jour d'un litige.
--
-- `auth_role() is null` : la cle service-role n'a pas de claim, et les outils
-- de plateforme journalisent pour le compte d'autrui a dessein.
-- ----------------------------------------------------------------------------
drop policy if exists audit_log_insert on public.audit_log;

create policy audit_log_insert on public.audit_log for insert
  with check (
    is_super_admin()
    or auth_role() is null
    or ("etablissementId" = auth_etablissement_id() and "userId" = auth.uid())
  );

-- ----------------------------------------------------------------------------
-- 5. Les fonctions exposees a l'API publique
--
-- Une fonction declencheur ne s'appelle pas en RPC — Postgres refuse. Mais la
-- laisser octroyee la fait figurer dans l'API publique et dans les
-- avertissements, ou elle noie les vraies. On retire ce qui n'a jamais eu de
-- raison d'etre appelable.
--
-- Les trois fonctions d'idempotence exigent deja une session et refusent
-- `auth.uid()` nul : le retrait a `anon` ne ferme rien qui fonctionnait, il
-- retire seulement une surface.
-- ----------------------------------------------------------------------------
revoke execute on function public.fn_limiter_ecoles_fondatrices() from anon, authenticated;
revoke execute on function public.fn_proteger_coefficients_nationaux() from anon, authenticated;
revoke execute on function public.fn_proteger_facturation() from anon, authenticated;
revoke execute on function public.fn_proteger_referentiel_annee() from anon, authenticated;
revoke execute on function public.fn_proteger_champs_utilisateur() from anon, authenticated;
revoke execute on function public.touch_updated_at() from anon, authenticated;

revoke execute on function public.fn_reclamer_operation(uuid, text) from anon;
revoke execute on function public.fn_achever_operation(uuid, jsonb) from anon;
revoke execute on function public.fn_abandonner_operation(uuid) from anon;

-- `drapeau_actif` n'est appelee que par `src/services/drapeau.ts`, garde aux
-- cinq roles. Aucun chemin anonyme ne la traverse — verifie avant de retirer.
revoke execute on function public.drapeau_actif(text) from anon;

-- ----------------------------------------------------------------------------
-- 6. Deux fonctions de `controle` sans `search_path`
--
-- Elles ne sont pas `security definer`, donc il n'y a pas d'escalade a la cle.
-- Mais une fonction sans `search_path` resout ses noms dans celui de
-- l'appelant, et `fn_journal_immuable` est precisement ce qui rend le journal
-- de la Regie non reecrivable : une garde dont la resolution depend de
-- l'appelant n'est pas une garde.
-- ----------------------------------------------------------------------------
alter function controle.fn_journal_immuable() set search_path = controle, pg_catalog;
alter function controle.meta_sans_contenu(jsonb) set search_path = controle, pg_catalog;

-- ----------------------------------------------------------------------------
-- 7. Le stockage : ce que l'application ferme, le bucket l'ouvrait
--
-- `documents_tenant_select` laissait tout compte de l'ecole telecharger tout
-- le bucket de l'ecole. La finance est fermee a l'enseignant dans
-- l'application — aucune page, aucun service —, et il tirait pourtant les
-- recus de paiement. Constate le 2026-09-17 : 31 Ko de PDF recuperes par un
-- compte ENSEIGNANT, par le chemin reel.
--
-- Le chemin porte deja la distinction, sans rien a ajouter :
--   <etablissementId>/bulletins/BUL-2025-000001.pdf
--   <etablissementId>/recus/REC-2025-000001.pdf
--
-- L'enseignant garde les bulletins — `document.listDocumentsEleve` l'y
-- autorise, et c'est son metier. Il perd les recus.
--
-- La premiere chemise reste comparee a l'etablissement dans les deux
-- politiques : sans elle, resserrer par role rouvrirait l'ecole d'a cote.
-- ----------------------------------------------------------------------------
drop policy if exists documents_tenant_select on storage.objects;

create policy documents_bulletins_select on storage.objects for select
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[2] = 'bulletins'
    and (
      is_super_admin()
      or (
        (storage.foldername(name))[1] = auth_etablissement_id()::text
        and auth_role() = any (array['DIRECTEUR', 'SECRETAIRE', 'COMPTABLE', 'ENSEIGNANT'])
      )
    )
  );

create policy documents_recus_select on storage.objects for select
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[2] = 'recus'
    and (
      is_super_admin()
      or (
        (storage.foldername(name))[1] = auth_etablissement_id()::text
        and auth_role() = any (array['DIRECTEUR', 'SECRETAIRE', 'COMPTABLE'])
      )
    )
  );

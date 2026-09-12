-- Référentiel national : de la suggestion à l'autorité
-- ============================================================
-- Palier 1b. Suite de `20260912120000_referentiel_versionne.sql`.
--
-- ## Le choix d'architecture, et pourquoi pas l'autre
--
-- Deux façons de rendre le national obligatoire :
--
--   (A) **Résoudre à la lecture** — chaque lecteur consulte d'abord le
--       national, puis retombe sur la valeur de l'école. Source unique, mais il
--       faut toucher tous les lecteurs, reconstruire la correspondance par le
--       code matière à chaque calcul, et accepter que le barème d'un bulletin
--       déjà émis change sous nos pieds.
--
--   (B) **Projeter** — le national est recopié dans `coefficient_matiere` au
--       moment où une année scolaire est créée, et l'école ne peut plus
--       toucher ce qui a été projeté.
--
-- **(B) est retenu.** `resultats-classe.ts`, `rapport.ts` et le bulletin
-- continuent de lire exactement la même table, avec la même requête : aucun
-- lecteur n'est modifié, donc aucun bulletin ne peut changer de valeur par
-- effet de bord. Et l'historisation devient automatique — une année close n'est
-- jamais reprojetée, ses lignes restent ce qu'elles étaient.
--
-- Le prix de (B) est qu'une correction nationale ne se propage pas toute seule :
-- il faut une reprojection explicite, sur les seules années non closes. C'est
-- précisément la fonctionnalité `H6` de la Régie, avec son journal — et il vaut
-- mieux qu'une propagation soit un geste tracé qu'un effet invisible.
--
-- ## Ce que cette migration ne fait pas
--
-- Elle ne projette rien. Toutes les lignes existantes restent `LOCAL`, toutes
-- les années existantes restent hors référentiel national. **Aucun
-- comportement ne change tant que le service de projection n'est pas livré.**


-- ============================================================
-- L'année scolaire dit quel référentiel elle applique
-- ============================================================
-- La décision produit est : les écoles gardent leur passé et basculent à
-- l'année suivante. Porter cela par une comparaison de dates serait fragile —
-- il faudrait figer une « date de bascule » quelque part et la réinterpréter
-- à chaque lecture.
--
-- Un booléen par année scolaire le dit explicitement, se lit d'un coup d'œil,
-- et permet à une école de rester en arrière si un cas particulier l'exige.
--
-- `false` par défaut : les cinq années existantes ne bougent pas.
alter table annee_scolaire
  add column "referentielNational" boolean not null default false;

comment on column annee_scolaire."referentielNational" is
  'true = les coefficients de cette année sont projetés depuis le référentiel national et non modifiables par l''établissement. Les années créées avant le 2026-09-12 restent à false : leur passé ne doit pas bouger.';


-- ============================================================
-- D'où vient un coefficient d'établissement
-- ============================================================
-- `origine` dit si la ligne a été saisie par l'école ou projetée depuis le
-- national. `coefficientOfficielId` garde le lien vers la ligne source, ce qui
-- rend une reprojection vérifiable : on sait exactement quelle valeur
-- nationale a produit quelle valeur locale.
alter table coefficient_matiere
  add column origine origine_coefficient not null default 'LOCAL',
  add column "coefficientOfficielId" uuid references coefficient_officiel(id);

comment on column coefficient_matiere.origine is
  'LOCAL = saisi par l''établissement. OFFICIEL / CONVERGENT = projeté depuis coefficient_officiel, non modifiable par l''établissement.';

-- Une ligne projetée sait d'où elle vient ; une ligne locale n'a pas de source.
alter table coefficient_matiere
  add constraint coefficient_matiere_origine_coherente
    check (
      (origine = 'LOCAL' and "coefficientOfficielId" is null)
      or (origine <> 'LOCAL' and "coefficientOfficielId" is not null)
    );

-- Retrouver rapidement tout ce qu'une ligne nationale a produit — c'est la
-- requête de la reprojection.
create index idx_coefficient_matiere_source
  on coefficient_matiere ("coefficientOfficielId")
  where "coefficientOfficielId" is not null;


-- ============================================================
-- Ce que l'établissement ne peut plus faire
-- ============================================================
-- La RLS ne sait pas restreindre par colonne : elle laisse passer ou refuse la
-- ligne entière. Le dépôt a déjà résolu ce problème deux fois par un
-- déclencheur — `fn_proteger_dates_essai` pour les dates d'essai,
-- `fn_proteger_champs_utilisateur` pour le rôle et le statut d'un compte. Même
-- motif ici, pour la même raison.
--
-- Trois interdictions, et une troisième qui n'est pas évidente :
--   1. modifier une ligne projetée ;
--   2. la supprimer ;
--   3. **s'attribuer une origine nationale** — sans quoi une école se
--      fabriquerait un coefficient « officiel » de son choix, qui survivrait
--      ensuite à toute vérification de cohérence.
create or replace function fn_proteger_coefficients_nationaux()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_role_jwt text;
begin
  -- Rôle PostgREST du porteur (`service_role` pour la clé de service),
  -- distinct du rôle applicatif lu par `is_super_admin()`.
  v_role_jwt := coalesce(
    current_setting('request.jwt.claims', true)::jsonb ->> 'role',
    ''
  );

  -- `auth_role()` nul : appel hors session applicative — migration, semis,
  -- outil de plateforme. La RLS reste la barrière d'accès ; ce déclencheur ne
  -- protège que des colonnes, et n'a rien à dire à un appelant qui n'est pas
  -- un établissement. Même raisonnement que `fn_proteger_champs_utilisateur`.
  if auth_role() is null or is_super_admin() or v_role_jwt = 'service_role' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'DELETE' then
    if old.origine <> 'LOCAL' then
      raise exception 'Ce coefficient vient du référentiel national et ne peut pas être supprimé.'
        using errcode = '42501';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' and old.origine <> 'LOCAL' then
    raise exception 'Ce coefficient vient du référentiel national et ne peut pas être modifié.'
      using errcode = '42501';
  end if;

  if new.origine <> 'LOCAL' then
    raise exception 'Un établissement ne peut pas déclarer un coefficient comme officiel.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger trg_proteger_coefficients_nationaux
  before insert or update or delete on coefficient_matiere
  for each row execute function fn_proteger_coefficients_nationaux();


-- ============================================================
-- Et l'établissement ne choisit pas non plus son référentiel
-- ============================================================
-- `annee_scolaire` est écrite par l'établissement : sans protection, un
-- directeur remettrait `referentielNational` à `false` et retrouverait la main
-- sur ses coefficients. Exactement le contournement que les dates d'essai
-- avaient rendu possible avant `0016`.
create or replace function fn_proteger_referentiel_annee()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_role_jwt text;
begin
  v_role_jwt := coalesce(
    current_setting('request.jwt.claims', true)::jsonb ->> 'role',
    ''
  );

  if auth_role() is null or is_super_admin() or v_role_jwt = 'service_role' then
    return new;
  end if;

  if new."referentielNational" is distinct from old."referentielNational" then
    raise exception 'Le rattachement au référentiel national n''est pas modifiable.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger trg_proteger_referentiel_annee
  before update on annee_scolaire
  for each row execute function fn_proteger_referentiel_annee();

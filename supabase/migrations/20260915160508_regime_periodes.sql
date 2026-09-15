-- ============================================================
-- Régime de découpage de l'année : trimestre ou semestre
-- ============================================================
-- Certains lycées togolais fonctionnent au **semestre** — deux périodes — et
-- non au trimestre. Le produit imposait trois périodes à tout le monde.
--
-- ## Pourquoi l'énumération `periode` ne bouge pas
--
-- Le premier réflexe était d'ajouter `SEMESTRE_1` et `SEMESTRE_2` au type
-- `periode`. Ça aurait touché une trentaine de fichiers, le moteur de
-- moyennes, les gabarits PDF, les rapports, les statistiques et tous les
-- filtres d'écran — pour une différence qui n'est **pas** dans la donnée.
--
-- Un semestre est bâti exactement comme un trimestre : mêmes interrogations,
-- même devoir, même composition, mêmes coefficients. Seul le **nombre** de
-- périodes change, trois contre deux, et le mot qu'on emploie pour les nommer.
--
-- `TRIMESTRE_1` et `TRIMESTRE_2` sont donc réutilisés tels quels par une école
-- au semestre, et `TRIMESTRE_3` n'y est jamais employé. C'est une clé interne,
-- pas un libellé : l'affichage est décidé par `src/lib/periodes.ts`.
--
-- **Et le moteur n'a rien à corriger** : `moyenneAnnuelle` écarte déjà les
-- périodes nulles avant de diviser — corrigé le 2026-09-02, après le bulletin
-- qui affichait 4,11 pour un élève à 12,33. Une école au semestre a sa
-- troisième période toujours nulle, donc sa moyenne annuelle est la moyenne de
-- ses deux semestres, sans une ligne de plus.
--
-- ## Le régime vit sur l'établissement
--
-- Pas sur l'année scolaire : une école ne change pas de découpage d'une année
-- à l'autre, et le porter par l'année obligerait à le redécider chaque
-- rentrée — un oubli ferait alors basculer une école au trimestre sans que
-- personne l'ait voulu. Même raisonnement que `regimeTarifaire` (`0030`) :
-- c'est une identité, pas une transaction.
--
-- L'utilisateur l'a tranché explicitement le 2026-09-15 : **aucun mélange**.
-- Un complexe collège-lycée est entièrement à l'un ou à l'autre. Le régime est
-- donc une colonne d'établissement et non de cycle.
--
-- ## Valeur par défaut
--
-- `TRIMESTRE` : c'est ce que font toutes les écoles déjà en base, et une
-- colonne `not null` sans défaut refuserait l'insertion d'un établissement par
-- tout le code existant.

begin;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'regime_periodes') then
    create type regime_periodes as enum ('TRIMESTRE', 'SEMESTRE');
  end if;
end;
$$;

alter table etablissement
  add column if not exists "regimePeriodes" regime_periodes not null default 'TRIMESTRE';

comment on column etablissement."regimePeriodes" is
  'Decoupage de l''annee scolaire. SEMESTRE n''emploie que TRIMESTRE_1 et TRIMESTRE_2 du type `periode` : la cle ne change pas, seuls le libelle et le nombre de periodes proposees changent.';

-- ------------------------------------------------------------------
-- Vérification : la colonne existe, vaut TRIMESTRE partout, et le type
-- `periode` n'a pas bougé.
-- ------------------------------------------------------------------
do $$
declare
  v_valeurs_periode int;
  v_non_trimestre int;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'etablissement' and column_name = 'regimePeriodes'
  ) then
    raise exception 'La colonne regimePeriodes n''a pas ete creee.';
  end if;

  select count(*) into v_non_trimestre
  from etablissement where "regimePeriodes" <> 'TRIMESTRE';
  if v_non_trimestre > 0 then
    raise exception 'Des etablissements existants ont change de regime : % lignes.', v_non_trimestre;
  end if;

  -- Le point de la migration : ne pas toucher au type `periode`. S'il gagnait
  -- des valeurs un jour, ce serait une decision separee, et ce controle la
  -- rendrait visible au lieu de la laisser passer dans un lot de correctifs.
  select count(*) into v_valeurs_periode
  from pg_enum e join pg_type t on t.oid = e.enumtypid
  where t.typname = 'periode';
  if v_valeurs_periode <> 3 then
    raise exception 'Le type periode compte % valeurs, 3 attendues.', v_valeurs_periode;
  end if;

  raise notice 'Regime de periodes pose. Type periode inchange (3 valeurs).';
end;
$$;

commit;

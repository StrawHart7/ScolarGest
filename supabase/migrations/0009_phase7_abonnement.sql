-- Phase 7 — cycle de vie de l'abonnement SaaS (expiration, renouvellement).
-- Idempotent: `create or replace function` uniquement, pas de DDL de table.
--
-- `security definer` ici, contrairement aux RPC des phases précédentes : les
-- policies de `abonnement_etablissement` réservent l'écriture au SUPER_ADMIN
-- (0001_init.sql), or l'expiration doit pouvoir être constatée sans qu'un
-- SUPER_ADMIN soit connecté — sinon une école dont l'abonnement est échu
-- resterait ACTIF en base jusqu'à la prochaine visite de la console
-- plateforme. La fonction ne fait qu'une transition mécanique dictée par la
-- date, ne prend aucun paramètre libre et ne peut donc pas servir à élever
-- des privilèges.

-- ============================================================
-- fn_expirer_abonnements
-- ============================================================
-- Passe à EXPIRE tout abonnement ACTIF dont la date de fin est dépassée.
-- Ne touche pas les SUSPENDU : une suspension est une décision commerciale
-- explicite, elle prime sur l'échéance et doit être levée à la main.
-- Retourne le nombre d'abonnements expirés.
create or replace function fn_expirer_abonnements()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  update abonnement_etablissement
  set statut = 'EXPIRE'
  where statut = 'ACTIF'
    and "dateFin" < now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ============================================================
-- fn_renouveler_abonnement
-- ============================================================
-- Crée la période suivante d'un abonnement, sans jamais modifier la période
-- écoulée (même logique d'historisation que les tarifs scolaires : le passé
-- reste lisible tel qu'il a été facturé).
--
-- La nouvelle période démarre à la fin de la précédente si celle-ci est
-- encore à venir (renouvellement anticipé, pas de jour perdu), sinon à
-- aujourd'hui (renouvellement tardif, pas de période rétroactive facturée).
-- La durée vient du plan choisi : 'MOIS' → 1 mois, 'AN' → 1 an.
--
-- Le nouvel abonnement naît SUSPENDU et non ACTIF : l'accès n'est ouvert
-- qu'une fois le paiement constaté par le SUPER_ADMIN
-- (`validerPaiement`), conformément au processus manuel du doc 08 §21.
--
-- Retourne {abonnementId, dateDebut, dateFin}.
create or replace function fn_renouveler_abonnement(
  p_abonnement_id uuid,
  p_plan_id uuid
) returns jsonb
language plpgsql
security invoker
as $$
declare
  v_etablissement_id uuid;
  v_ancienne_fin timestamptz;
  v_duree text;
  v_debut timestamptz;
  v_fin timestamptz;
  v_nouveau_id uuid;
begin
  select "etablissementId", "dateFin"
  into v_etablissement_id, v_ancienne_fin
  from abonnement_etablissement
  where id = p_abonnement_id;

  if v_etablissement_id is null then
    raise exception 'Abonnement introuvable.' using errcode = 'P0001';
  end if;

  select duree into v_duree from plan_abonnement where id = p_plan_id;
  if v_duree is null then
    raise exception 'Plan introuvable.' using errcode = 'P0001';
  end if;

  v_debut := greatest(v_ancienne_fin, now());
  v_fin := case
    when v_duree = 'AN' then v_debut + interval '1 year'
    else v_debut + interval '1 month'
  end;

  insert into abonnement_etablissement
    ("etablissementId", "planId", "dateDebut", "dateFin", statut)
  values (v_etablissement_id, p_plan_id, v_debut, v_fin, 'SUSPENDU')
  returning id into v_nouveau_id;

  return jsonb_build_object(
    'abonnementId', v_nouveau_id,
    'dateDebut', v_debut,
    'dateFin', v_fin
  );
end;
$$;

-- Restructuration du modèle d'abonnement : la suspension quitte l'abonnement
-- pour l'établissement, et le montant facturé cesse d'être facultatif.
--
-- ============================================================
-- 1. La suspension porte sur l'école, pas sur une période
-- ============================================================
-- `abonnement_etablissement.statut = 'SUSPENDU'` posait deux problèmes.
--
-- D'abord un contresens de modélisation : suspendre est une décision
-- commerciale qui vise un établissement (impayé persistant, litige), pas la
-- période de facturation en cours. Ensuite, et c'est le plus grave, la
-- sanction s'effaçait d'elle-même : l'abonnement courant étant « celui dont la
-- dateFin est la plus lointaine », toute nouvelle période rendait l'école
-- active. Une école suspendue redevenait donc opérationnelle en payant, ce qui
-- vide la suspension de son sens — elle est précisément faite pour les cas où
-- un paiement ne suffit pas à régler la situation.
--
-- Le motif est obligatoire dès qu'une suspension est posée, et il est montré
-- au Directeur et à la Secrétaire. Une école coupée sans explication appelle
-- le support pour demander pourquoi ; celle qui lit le motif appelle pour le
-- résoudre.
alter table etablissement
  add column if not exists "suspenduLe" timestamptz,
  add column if not exists "motifSuspension" text;

alter table etablissement
  drop constraint if exists etablissement_motif_suspension_requis;
alter table etablissement
  add constraint etablissement_motif_suspension_requis check (
    "suspenduLe" is null
    or ("motifSuspension" is not null and length(btrim("motifSuspension")) >= 10)
  );

comment on column etablissement."suspenduLe" is
  'Date de suspension par la plateforme. NULL = école non suspendue. Décision du SUPER_ADMIN uniquement, protégée par fn_proteger_facturation.';
comment on column etablissement."motifSuspension" is
  'Motif affiché au Directeur et à la Secrétaire. Obligatoire (10 caractères minimum) dès que suspenduLe est renseigné.';

-- Reprise des suspensions existantes. Aucune ligne n'est concernée sur la base
-- actuelle, mais la migration doit rester juste sur une base qui en porterait.
update etablissement e
set "suspenduLe" = now(),
    "motifSuspension" = 'Suspension reprise du statut d''abonnement (migration 0026).'
where "suspenduLe" is null
  and exists (
    select 1 from abonnement_etablissement a
    where a."etablissementId" = e.id and a.statut = 'SUSPENDU'
  );

-- Les lignes reprises repassent en EXPIRE : leur statut ne décide plus rien,
-- et laisser SUSPENDU sur l'abonnement entretiendrait deux sources de vérité.
update abonnement_etablissement set statut = 'EXPIRE' where statut = 'SUSPENDU';

-- La valeur reste dans l'énumération : la retirer casserait les exports et les
-- lignes d'audit qui la mentionnent. Elle n'est simplement plus écrite.
comment on type statut_abonnement is
  'ACTIF / EXPIRE. SUSPENDU est conservé pour l''historique mais n''est plus écrit depuis la migration 0026 : la suspension vit sur etablissement.suspenduLe.';

-- ============================================================
-- 2. Le tenant ne décide ni de son essai, ni de sa suspension
-- ============================================================
-- La policy `etablissement_tenant` (0001) est `for all` : un Directeur écrit
-- sur la ligne de son propre établissement. Sans cette garde, il lui suffirait
-- d'un UPDATE pour lever sa propre suspension — exactement le trou que
-- `fn_proteger_dates_essai` avait déjà fermé pour les dates d'essai.
--
-- La fonction est donc élargie plutôt que doublée : deux triggers concurrents
-- sur la même table finiraient par diverger, et l'ordre d'exécution entre eux
-- serait une subtilité de plus à retenir.
create or replace function fn_proteger_facturation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role_jwt text;
begin
  -- Rôle PostgREST du porteur (`service_role` pour la clé de service),
  -- distinct du rôle applicatif lu par `is_super_admin()`. Voir 0016 : sans
  -- cette reconnaissance, le trigger bloquait les outils de la plateforme.
  v_role_jwt := coalesce(
    current_setting('request.jwt.claims', true)::jsonb ->> 'role',
    ''
  );

  if is_super_admin() or v_role_jwt = 'service_role' then
    return new;
  end if;

  if new."suspenduLe" is distinct from old."suspenduLe"
     or new."motifSuspension" is distinct from old."motifSuspension" then
    raise exception 'La suspension est une décision de la plateforme.'
      using errcode = '42501';
  end if;

  if old."essaiDebuteLe" is null and new."essaiDebuteLe" is not null then
    -- Démarrage : les dates sont imposées par le serveur, jamais par
    -- l'appelant. Quoi qu'envoie le client, l'essai vaut 30 jours.
    new."essaiDebuteLe" := now();
    new."essaiFinLe" := now() + (30 || ' days')::interval;
    return new;
  end if;

  if new."essaiDebuteLe" is distinct from old."essaiDebuteLe"
     or new."essaiFinLe" is distinct from old."essaiFinLe" then
    raise exception 'Les dates d''essai ne sont pas modifiables.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_proteger_dates_essai on etablissement;
drop trigger if exists trg_proteger_facturation on etablissement;
create trigger trg_proteger_facturation
  before update on etablissement
  for each row execute function fn_proteger_facturation();

-- L'ancienne fonction n'est plus référencée par aucun trigger.
drop function if exists fn_proteger_dates_essai();

-- ============================================================
-- 3. Un abonnement sait toujours ce qu'il a coûté
-- ============================================================
-- `createAbonnement` (voie manuelle du SUPER_ADMIN) n'écrivait ni nombreCycles
-- ni montantTotal. Résultat constaté en base : deux abonnements à montant nul
-- et un à 250 000 F qui ne correspond à aucune ligne du catalogue. Le revenu
-- affiché par la console plateforme s'appuie sur cette colonne : un NULL n'y
-- est pas une donnée manquante, c'est un chiffre d'affaires faux.
update abonnement_etablissement a
set "montantTotal" = round(p.prix * a."nombreCycles", 2)
from plan_abonnement p
where a."planId" = p.id
  and a."montantTotal" is null;

alter table abonnement_etablissement
  alter column "montantTotal" set not null;

comment on column abonnement_etablissement."montantTotal" is
  'Montant réellement facturé (prix du plan x nombreCycles), historisé et NOT NULL depuis 0026. Ne jamais le recalculer depuis le catalogue : le prix peut avoir changé depuis.';

-- ============================================================
-- 4. Relances : ne pas écrire deux fois le même mail
-- ============================================================
-- Le balayage quotidien est rejouable — un cron peut être déclenché deux fois,
-- et une relance ne doit pas partir en double. L'unicité porte sur
-- (établissement, sujet, palier) : c'est l'état qui fait foi, pas un
-- identifiant d'exécution, même raisonnement que l'idempotence du webhook
-- FedaPay (`transaction_fedapay.abonnementId` non nul = déjà honorée).
create table if not exists relance_abonnement (
  id uuid primary key default gen_random_uuid(),
  "etablissementId" uuid not null references etablissement(id) on delete cascade,
  -- ESSAI ou ABONNEMENT : les deux comptes à rebours sont distincts et une
  -- école peut recevoir les deux la même année.
  sujet text not null check (sujet in ('ESSAI', 'ABONNEMENT')),
  -- Jours restants au moment de l'envoi (0 pour l'échéance atteinte).
  palier integer not null check (palier >= 0),
  -- Échéance visée. Sans elle, une école renouvelant chaque année ne recevrait
  -- sa relance J-15 qu'une seule fois dans sa vie.
  echeance timestamptz not null,
  "envoyeLe" timestamptz not null default now(),
  destinataires text[] not null default '{}',
  erreur text
);

create unique index if not exists idx_relance_unique
  on relance_abonnement ("etablissementId", sujet, palier, echeance);

alter table relance_abonnement enable row level security;

-- Lecture par l'école concernée (elle a le droit de savoir ce qu'on lui a
-- envoyé) ; écriture réservée à la clé service-role, seule employée par le
-- balayage. Aucune policy d'écriture n'est donc déclarée : RLS refuse par
-- défaut, et service_role la contourne.
create policy relance_read on relance_abonnement for select
  using (is_super_admin() or "etablissementId" = auth_etablissement_id());

comment on table relance_abonnement is
  'Trace des relances d''échéance envoyées. L''unicité (établissement, sujet, palier, échéance) rend le balayage quotidien rejouable sans doublon.';

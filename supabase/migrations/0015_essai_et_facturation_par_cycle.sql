-- Socle du modèle économique : essai gratuit de 30 jours et facturation
-- proportionnelle au nombre de cycles exploités.
--
-- Deux principes de modélisation.
--
-- 1. L'essai n'est PAS un abonnement. `abonnement_etablissement.planId` est
--    NOT NULL : y loger un essai imposerait d'inventer un plan fictif à prix
--    nul, qui apparaîtrait ensuite dans l'historique de facturation et dans
--    les relances. L'essai est un attribut de l'établissement, pas une vente.
--
-- 2. Le montant facturé est historisé sur la ligne d'abonnement. Même règle
--    que les tarifs scolaires : changer le prix du catalogue ne doit jamais
--    réécrire ce qu'une école a réellement payé l'an dernier.

-- ============================================================
-- Essai gratuit
-- ============================================================
-- Deux colonnes plutôt qu'une. `essaiDebuteLe` sert la mesure (délai entre
-- l'ouverture du compte et le premier geste réel, taux de conversion) ;
-- `essaiFinLe` sert la décision d'accès, et reste ajustable — prolonger un
-- essai est un geste commercial courant, il ne doit pas exiger de migration.
alter table etablissement
  add column if not exists "essaiDebuteLe" timestamptz,
  add column if not exists "essaiFinLe" timestamptz;

comment on column etablissement."essaiDebuteLe" is
  'Début de l''essai gratuit : première écriture réelle du Directeur (définition de son PIN au démarrage). NULL tant que rien n''a été configuré.';
comment on column etablissement."essaiFinLe" is
  'Fin de l''essai gratuit. Ajustable à la main pour un geste commercial.';

-- ============================================================
-- Facturation par cycle
-- ============================================================
-- Le prix du catalogue est celui d'UN cycle. Un complexe collège + lycée
-- porte deux cycles actifs et paie donc le double. `cycle_etablissement`
-- modélise déjà exactement cette quantité — rien de nouveau à saisir, et
-- `activerCycle` étant gardée par le PIN du Directeur, la quantité ne peut
-- pas être gonflée ou dégonflée par un simple clic.
alter table abonnement_etablissement
  add column if not exists "nombreCycles" integer not null default 1,
  add column if not exists "montantTotal" numeric(12, 2);

alter table abonnement_etablissement
  drop constraint if exists abonnement_nombre_cycles_positif;
alter table abonnement_etablissement
  add constraint abonnement_nombre_cycles_positif check ("nombreCycles" >= 1);

comment on column abonnement_etablissement."nombreCycles" is
  'Nombre de cycles facturés sur cette période, figé à la souscription. Un cycle activé plus tard ne renchérit pas la période en cours.';
comment on column abonnement_etablissement."montantTotal" is
  'Montant réellement facturé (prix du plan x nombreCycles), historisé. Ne jamais le recalculer depuis le catalogue : le prix du plan peut avoir changé depuis.';

-- Reprise des lignes existantes : elles ont été souscrites avant la
-- facturation par cycle, à un montant qui était celui du plan entier.
update abonnement_etablissement a
set "montantTotal" = p.prix
from plan_abonnement p
where a."planId" = p.id
  and a."montantTotal" is null;

-- ============================================================
-- Catalogue tarifaire
-- ============================================================
-- 10 000 F/mois et 100 000 F/an, par cycle. Un complexe collège + lycée
-- revient donc à 20 000 F/mois ou 200 000 F/an.
--
-- Le rapport annuel/mensuel est de 10 pour 12 : l'engagement annuel
-- n'est gagnant que d'environ un mois d'utilisation réelle. C'est un choix
-- assumé, pas un oubli.
insert into plan_abonnement (nom, duree, prix) values
  ('Mensuel', 'MOIS', 10000),
  ('Annuel', 'AN', 100000)
on conflict (nom) do update set duree = excluded.duree, prix = excluded.prix;

-- ============================================================
-- Protection des dates d'essai
-- ============================================================
-- La policy `etablissement_tenant` (0001_init.sql) est `for all` : un Directeur
-- peut écrire sur la ligne de son propre établissement. Sans garde, il lui
-- suffirait donc d'un UPDATE pour repousser `essaiFinLe` de dix ans — le
-- paywall serait contournable par son bénéficiaire, ce qui n'en est pas un.
--
-- La garde vit en base et non dans le service : la RLS autorise l'écriture,
-- et une règle applicative ne couvrirait pas un appel direct à PostgREST.
--
-- Plutôt que d'interdire l'écriture puis d'ouvrir une exception pour le
-- démarrage légitime, le trigger **récrit** les valeurs : quoi que le client
-- envoie, le premier démarrage vaut `now()` et `now() + 30 jours`. Il n'y a
-- donc aucune valeur à valider, et aucun drapeau de session à faire circuler.
-- Le SUPER_ADMIN reste libre d'ajuster : prolonger un essai est un geste
-- commercial, il doit rester possible depuis la console plateforme.
create or replace function fn_proteger_dates_essai()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if is_super_admin() then
    return new;
  end if;

  if old."essaiDebuteLe" is null and new."essaiDebuteLe" is not null then
    -- Démarrage : les dates sont imposées par le serveur, jamais par l'appelant.
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
create trigger trg_proteger_dates_essai
  before update on etablissement
  for each row execute function fn_proteger_dates_essai();

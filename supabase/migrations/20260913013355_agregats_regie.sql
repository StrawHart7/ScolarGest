-- Régie — M6. Les agrégats : voir sans lire
-- ============================================================
-- Le problème posé par le plan : la Régie doit afficher des compteurs dérivés
-- du contenu — effectifs, jalons de configuration, revenu — **sans avoir le
-- droit de lire ce contenu**. Le rôle `regie` n'a aucun droit sur `eleve`,
-- `inscription`, `facture_eleve` ni `etablissement`, et c'est la garantie
-- qu'on ne veut pas assouplir pour un chiffre.
--
-- La réponse : des **vues matérialisées dans `controle`**, possédées par
-- `postgres`, rafraîchies par une fonction `SECURITY DEFINER`. La Régie ne
-- fait qu'un `SELECT` sur le résultat. Elle voit « 286 inscriptions actives »,
-- jamais la ligne d'un élève.
--
-- ## Deux raisons de matérialiser plutôt que de poser une vue simple
--
-- 1. **Une vue non matérialisée s'exécute avec les droits de l'appelant.** Le
--    `SELECT` se ferait donc comme `regie`, qui n'a pas accès aux tables
--    sources — la vue échouerait, ou pire, renverrait zéro ligne si la RLS
--    filtrait au lieu de refuser. Une matérialisée porte des données déjà
--    calculées : la question des droits sur les sources ne se pose plus au
--    moment de la lecture.
-- 2. Le calcul balaie toutes les écoles. Le payer à chaque affichage du
--    cockpit serait absurde pour une donnée qui bouge à l'heure.
--
-- ## Le piège de la RLS, et pourquoi il ne se déclenche pas ici
--
-- Le rafraîchissement s'exécute comme propriétaire de la vue, donc comme
-- `postgres`. Or `postgres` est aussi propriétaire des quatorze tables lues,
-- et **Postgres n'applique pas la RLS au propriétaire d'une table** tant que
-- `FORCE ROW LEVEL SECURITY` n'est pas posé — vérifié table par table avant
-- d'écrire ceci : `relforcerowsecurity` vaut `false` partout.
--
-- Si ce n'était pas le cas, les politiques compareraient `auth_etablissement_id()`
-- — nul hors session — et les vues seraient **silencieusement vides**. Pas une
-- erreur : des zéros. Le cockpit afficherait « 0 école » sur une plateforme qui
-- en compte douze, et rien ne dirait pourquoi. D'où le contrôle de vraisemblance
-- à la fin de cette migration : mieux vaut refuser d'appliquer que livrer des
-- zéros crédibles.


-- ============================================================
-- 1. Quand les agrégats ont-ils été calculés
-- ============================================================
-- Un chiffre sans sa date de calcul est un chiffre qu'on croit vivant. La
-- Régie affiche « calculé il y a 7 min » à côté de chaque compteur, et le
-- bouton de rafraîchissement est explicite.
create table controle.agregat_rafraichissement (
  nom text primary key,
  "rafraichiLe" timestamptz not null default now(),
  "dureeMs" int
);

insert into controle.agregat_rafraichissement (nom, "rafraichiLe")
values ('mv_sante_ecole', 'epoch'::timestamptz), ('mv_revenu', 'epoch'::timestamptz);


-- ============================================================
-- 2. La santé d'une école
-- ============================================================
-- Une ligne par école. Des compteurs et des dates, **aucun nom de personne**.
-- Le nom de l'établissement est la seule chaîne libre : sans lui la Régie
-- afficherait une liste d'UUID, et l'école est le client — pas le sujet
-- protégé. Ses élèves le sont.
create materialized view controle.mv_sante_ecole as
with derniere_annee as (
  select distinct on ("etablissementId") "etablissementId", id, libelle, statut, "referentielNational"
    from annee_scolaire
   order by "etablissementId", "dateDebut" desc
),
abonnement_courant as (
  select distinct on (a."etablissementId")
         a."etablissementId", a.statut::text as statut, a."dateFin", a."montantTotal", a."nombreCycles",
         p.code as "planCode"
    from abonnement_etablissement a
    join plan_abonnement p on p.id = a."planId"
   order by a."etablissementId", a."dateFin" desc
)
select
  e.id                                   as "etablissementId",
  e.nom,
  e.ville,
  e.statut::text                         as "statutEtablissement",
  e."regimeTarifaire"::text              as "regimeTarifaire",
  e."createdAt"                          as "creeeLe",
  e."essaiDebuteLe",
  e."essaiFinLe",
  e."suspenduLe",
  e."motifSuspension",
  ab.statut                              as "statutAbonnement",
  ab."dateFin"                           as "finAbonnement",
  ab."planCode",
  ab."montantTotal",
  ab."nombreCycles",
  da.libelle                             as "anneeCourante",
  da.statut::text                        as "statutAnnee",
  da."referentielNational",
  (select count(*) from cycle_etablissement ce where ce."etablissementId" = e.id
     and ce.actif)                                                                     as "nbCycles",
  (select count(*) from classe c where c."etablissementId" = e.id
     and c."anneeScolaireId" = da.id)                                                  as "nbClasses",
  -- Les effectifs se comptent sur `inscription` en statut ACTIVE, jamais sur
  -- `eleve`, qui accumule les élèves partis. Même règle que la console
  -- SUPER_ADMIN du produit : deux écrans qui compteraient différemment
  -- détruiraient la confiance dans les deux.
  (select count(*) from inscription i where i."etablissementId" = e.id
     and i.statut = 'ACTIVE' and i."anneeScolaireId" = da.id)                          as "nbInscriptionsActives",
  (select count(*) from utilisateur u where u."etablissementId" = e.id
     and u.statut = 'ACTIF')                                                           as "nbUtilisateurs",
  (select count(*) from enseignant ens where ens."etablissementId" = e.id)             as "nbEnseignants",
  (select count(*) from document d where d."etablissementId" = e.id
     and d.type = 'BULLETIN' and d.statut = 'GENERE')                                  as "nbBulletins",
  -- « Ouverte » se dit en énumérant les deux statuts vivants, jamais par
  -- `<> 'RESOLUE'` : `statut_support` porte aussi FERMEE, et la nier aurait
  -- compté comme en attente toute demande classée sans suite.
  (select count(*) from support_demande s where s."etablissementId" = e.id
     and s.statut in ('NOUVELLE', 'EN_COURS'))                                         as "nbSupportOuvert",
  -- La dernière activité réelle, et non la dernière connexion : ouvrir une
  -- page ne dit pas qu'on se sert du produit. `audit_log` ne consigne que des
  -- écritures sensibles, ce qui en fait exactement le bon signal.
  (select max(a.date) from audit_log a where a."etablissementId" = e.id)               as "derniereEcritureLe",
  (select max(u."dernierAcces") from utilisateur u where u."etablissementId" = e.id)   as "derniereConnexionLe"
from etablissement e
left join derniere_annee da on da."etablissementId" = e.id
left join abonnement_courant ab on ab."etablissementId" = e.id;

create unique index mv_sante_ecole_pk on controle.mv_sante_ecole ("etablissementId");

comment on materialized view controle.mv_sante_ecole is
  'Un agrégat par école : compteurs, jalons et dates. Aucun nom de personne, aucune ligne de contenu. C''est le seul chemin par lequel la Régie sait quelque chose d''une école.';


-- ============================================================
-- 3. Le revenu
-- ============================================================
-- **Le revenu vient de `montantTotal`**, figé à la souscription, jamais de
-- `plan_abonnement` : recalculer depuis le catalogue réécrirait
-- rétroactivement le revenu constaté à chaque changement de prix. Règle reprise
-- telle quelle de la console SUPER_ADMIN du produit, et pour la même raison.
create materialized view controle.mv_revenu as
select
  date_trunc('month', pa.date)      as mois,
  count(*)                          as "nbReglements",
  sum(pa.montant)                   as montant,
  count(distinct a."etablissementId") as "nbEcoles"
from paiement_abonnement pa
join abonnement_etablissement a on a.id = pa."abonnementId"
group by 1;

create unique index mv_revenu_pk on controle.mv_revenu (mois);

comment on materialized view controle.mv_revenu is
  'Encaissements d''abonnement par mois. Rien sur les frais de scolarité des écoles, qui ne regardent pas la plateforme.';


-- ============================================================
-- 4. Le rafraîchissement
-- ============================================================
-- `pg_cron` n'est pas installé sur ce projet — vérifié, `pg_extension` ne
-- contient que `pg_stat_statements`, `pgcrypto`, `plpgsql`, `supabase_vault`
-- et `uuid-ossp`. Plutôt que d'ajouter une extension pour une console à un
-- seul utilisateur, le rafraîchissement est **déclenché par l'affichage**,
-- avec un âge minimum.
--
-- Ce n'est pas un pis-aller : un agrégat ne sert que lorsqu'on le regarde, et
-- un cron qui recalcule toutes les nuit une vue que personne n'ouvre pendant
-- trois semaines n'apporte rien. L'âge est affiché, donc le compromis est
-- visible plutôt que caché.
--
-- **Pas de `concurrently`**, bien que l'index unique soit là pour le
-- permettre : `REFRESH MATERIALIZED VIEW CONCURRENTLY` ne s'exécute pas dans
-- un bloc transactionnel, donc pas depuis une fonction — la première version
-- de cette migration aurait échoué à l'application. Le verrou exclusif qu'on
-- prend à la place dure le temps du calcul, sur une vue que seule la Régie
-- lit, et il ne touche pas les tables du produit. À douze écoles, c'est
-- quelques millisecondes ; le jour où ce ne le sera plus, il faudra sortir le
-- rafraîchissement d'une fonction, pas le rendre concurrent ici.
create or replace function controle.rafraichir_agregats(p_force boolean default false)
returns timestamptz
language plpgsql
security definer
set search_path = controle, public, pg_catalog
as $fn$
declare
  v_age interval;
  v_debut timestamptz;
begin
  select now() - min("rafraichiLe") into v_age from controle.agregat_rafraichissement;

  -- Dix minutes : assez pour qu'une série de clics ne recalcule pas tout à
  -- chaque écran, assez court pour qu'un chiffre affiché soit encore vrai.
  if not p_force and v_age < interval '10 minutes' then
    return (select min("rafraichiLe") from controle.agregat_rafraichissement);
  end if;

  -- Sérialise les rafraîchissements concurrents. Sans ce verrou, deux onglets
  -- ouverts ensemble lanceraient deux balayages complets de la base — la Régie
  -- gênerait alors le produit, ce qu'elle ne doit jamais faire.
  if not pg_try_advisory_xact_lock(hashtext('controle.rafraichir_agregats')) then
    return (select min("rafraichiLe") from controle.agregat_rafraichissement);
  end if;

  v_debut := clock_timestamp();
  refresh materialized view controle.mv_sante_ecole;
  update controle.agregat_rafraichissement
     set "rafraichiLe" = now(),
         -- `extract(epoch from ...)` et non `extract(milliseconds ...)`, qui
         -- ne rend que la partie sous la minute : un calcul de 70 s se serait
         -- affiché comme 10 s, et la lenteur qu'on veut voir aurait disparu.
         "dureeMs" = (extract(epoch from clock_timestamp() - v_debut) * 1000)::int
   where nom = 'mv_sante_ecole';

  v_debut := clock_timestamp();
  refresh materialized view controle.mv_revenu;
  update controle.agregat_rafraichissement
     set "rafraichiLe" = now(),
         "dureeMs" = (extract(epoch from clock_timestamp() - v_debut) * 1000)::int
   where nom = 'mv_revenu';

  return now();
end;
$fn$;

comment on function controle.rafraichir_agregats(boolean) is
  'Recalcule les vues matérialisées si elles ont plus de dix minutes. Déclenché par l''affichage du cockpit, faute de pg_cron sur ce projet.';


-- ============================================================
-- 5. Les notes et les tâches
-- ============================================================
-- Ce que la Régie sait et que la base ne dit pas : « rappeler la directrice
-- avant la rentrée », « ils attendent l'export des bulletins de l'an dernier ».
-- C'est le seul endroit de tout le plan de contrôle où du texte libre est
-- permis — il est écrit par l'opérateur, sur lui-même, et ne vient d'aucune
-- école.
create table controle.note_ecole (
  id bigint generated always as identity primary key,
  "etablissementId" uuid not null,
  texte text not null check (length(btrim(texte)) >= 3),
  auteur text not null,
  "createdAt" timestamptz not null default now()
);

create index idx_note_ecole on controle.note_ecole ("etablissementId", "createdAt" desc);

create table controle.tache (
  id bigint generated always as identity primary key,
  -- Nulle quand la tâche ne concerne pas une école en particulier.
  "etablissementId" uuid,
  intitule text not null check (length(btrim(intitule)) >= 3),
  echeance date,
  statut text not null default 'OUVERTE' check (statut in ('OUVERTE', 'FAITE', 'ABANDONNEE')),
  auteur text not null,
  "createdAt" timestamptz not null default now(),
  "termineeLe" timestamptz
);

create index idx_tache_ouverte on controle.tache (statut, echeance nulls last);

comment on table controle.tache is
  'File de gestes de l''opérateur. Aucune incidence sur le produit : rien ici n''est lu par une école.';


-- ============================================================
-- 6. Droits, puis contrôle de vraisemblance
-- ============================================================
-- Les `default privileges` posés en M0 couvrent les tables nouvelles de
-- `controle`, mais **pas les vues matérialisées** : Postgres les range dans
-- une catégorie distincte que `alter default privileges ... on tables` ne
-- vise pas. Sans ces deux lignes, la Régie aurait affiché un refus de
-- permission sur son écran d'accueil.
grant select on controle.mv_sante_ecole to regie;
grant select on controle.mv_revenu to regie;
grant execute on function controle.rafraichir_agregats(boolean) to regie;

-- Premier calcul, et **vérification qu'il a produit quelque chose**.
--
-- C'est le contrôle qui manquait à trois scripts de ce dépôt avant qu'on ne
-- l'y ajoute : une lecture qui ne ramène rien parce que la RLS a filtré ne se
-- distingue pas d'une base vide. Ici la distinction est faisable — on compte
-- les écoles à la source et dans la vue — alors on la fait, et on refuse
-- d'appliquer plutôt que de livrer des zéros crédibles.
do $do$
declare
  v_source bigint;
  v_vue bigint;
begin
  perform controle.rafraichir_agregats(true);

  select count(*) into v_source from etablissement;
  select count(*) into v_vue from controle.mv_sante_ecole;

  if v_source <> v_vue then
    raise exception
      'mv_sante_ecole porte % lignes pour % établissements. La RLS a filtré le rafraîchissement : les agrégats seraient silencieusement faux.',
      v_vue, v_source;
  end if;

  raise notice 'Agrégats calculés : % écoles.', v_vue;
end;
$do$;

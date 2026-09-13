-- Régie — l'année de référence est l'année ACTIVE, pas la plus récente
-- ============================================================
-- Correctif d'un défaut trouvé en regardant le premier calcul réel, et qui
-- serait passé inaperçu indéfiniment : il ne produit ni erreur, ni page
-- blanche, ni ligne manquante. Il produit des **zéros crédibles**.
--
-- ## Ce qui était faux
--
-- `mv_sante_ecole` retenait, par école, l'année scolaire de `dateDebut` la
-- plus récente. Sur la base réelle :
--
--   Les Victorieux · 2026-2027 · TERMINEE · 0 classe  · 0 inscrit   ← retenue
--   Les Victorieux · 2025-2026 · ACTIVE   · 14 classes · 286 inscrits
--
-- La console aurait donc affiché « Les Victorieux : 0 classe, 0 élève », et
-- l'aurait rangée parmi les écoles silencieuses. Sur les cinq écoles de la
-- base, le total des inscriptions tombait à **zéro**.
--
-- C'est exactement le défaut contre lequel le contrôle de vraisemblance de
-- `agregats_regie` avait été écrit — sauf que celui-ci comptait les **lignes**
-- de la vue, et il y en avait bien cinq. Compter les lignes ne dit rien de ce
-- qu'elles contiennent. Le contrôle ajouté en fin de fichier porte cette fois
-- sur le contenu.
--
-- ## Pourquoi `dateDebut` était un mauvais critère
--
-- Une école prépare l'année suivante avant de clore la courante : la ligne la
-- plus récente est donc régulièrement une année **à venir**, vide par nature.
-- Le produit, lui, a toujours raisonné sur le statut — « une seule année
-- scolaire active par établissement » est l'un de ses invariants. La vue
-- s'aligne dessus.
--
-- `dateDebut` reste le second critère, et `id` le troisième : sans un
-- départage total, `distinct on` choisit arbitrairement et la vue change de
-- réponse d'un rafraîchissement à l'autre, sans que rien ne bouge en base.
--
-- ## `nbAnneesActives`, et une fausse alerte qui valait la colonne
--
-- En relevant les données j'ai cru voir « Wisdom Agbodeka » porter deux
-- années 2026-2027 ACTIVE, donc l'invariant « une seule année active par
-- établissement » enfreint. **C'était faux** : ce sont deux *établissements*
-- distincts qui portent le même nom, chacun avec une seule année active. Deux
-- lignes d'un relevé trié par nom, lues comme une anomalie.
--
-- La colonne reste, et pour une raison qui survit à l'erreur : cet invariant
-- n'est tenu nulle part par une contrainte — il vit dans les services, que
-- l'appelant peut sauter, comme les gardes de rôle avant que la RLS ne porte
-- les rôles. Le jour où il serait enfreint, `distinct on` choisirait en
-- silence laquelle des deux années compte, et la console afficherait des
-- chiffres cohérents et faux. `nbAnneesActives` fait dire à la vue ce
-- qu'elle ne sait pas trancher.
--
-- Poser l'index unique qui l'interdirait est une décision produit, sur des
-- données existantes — elle n'appartient pas à une migration de la Régie.

drop materialized view controle.mv_sante_ecole;

create materialized view controle.mv_sante_ecole as
with annee_reference as (
  -- L'ordre porte toute la correction : statut d'abord, date ensuite, `id`
  -- pour que le choix soit **total** et donc reproductible.
  select distinct on ("etablissementId")
         "etablissementId", id, libelle, statut, "referentielNational"
    from annee_scolaire
   order by "etablissementId", (statut = 'ACTIVE') desc, "dateDebut" desc, id
),
abonnement_courant as (
  select distinct on (a."etablissementId")
         a."etablissementId", a.statut::text as statut, a."dateFin", a."montantTotal", a."nombreCycles",
         p.code as "planCode"
    from abonnement_etablissement a
    join plan_abonnement p on p.id = a."planId"
   order by a."etablissementId", a."dateFin" desc, a.id
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
  ar.libelle                             as "anneeCourante",
  ar.statut::text                        as "statutAnnee",
  ar."referentielNational",
  -- Doit valoir 0 ou 1. Au-delà, l'invariant produit est enfreint et la Régie
  -- doit le dire plutôt que de choisir pour l'école.
  (select count(*) from annee_scolaire a2
    where a2."etablissementId" = e.id and a2.statut = 'ACTIVE')                        as "nbAnneesActives",
  (select count(*) from cycle_etablissement ce where ce."etablissementId" = e.id
     and ce.actif)                                                                     as "nbCycles",
  (select count(*) from classe c where c."etablissementId" = e.id
     and c."anneeScolaireId" = ar.id)                                                  as "nbClasses",
  (select count(*) from inscription i where i."etablissementId" = e.id
     and i.statut = 'ACTIVE' and i."anneeScolaireId" = ar.id)                          as "nbInscriptionsActives",
  (select count(*) from utilisateur u where u."etablissementId" = e.id
     and u.statut = 'ACTIF')                                                           as "nbUtilisateurs",
  (select count(*) from enseignant ens where ens."etablissementId" = e.id)             as "nbEnseignants",
  (select count(*) from document d where d."etablissementId" = e.id
     and d.type = 'BULLETIN' and d.statut = 'GENERE')                                  as "nbBulletins",
  (select count(*) from support_demande s where s."etablissementId" = e.id
     and s.statut in ('NOUVELLE', 'EN_COURS'))                                         as "nbSupportOuvert",
  (select max(a.date) from audit_log a where a."etablissementId" = e.id)               as "derniereEcritureLe",
  (select max(u."dernierAcces") from utilisateur u where u."etablissementId" = e.id)   as "derniereConnexionLe"
from etablissement e
left join annee_reference ar on ar."etablissementId" = e.id
left join abonnement_courant ab on ab."etablissementId" = e.id;

create unique index mv_sante_ecole_pk on controle.mv_sante_ecole ("etablissementId");

comment on materialized view controle.mv_sante_ecole is
  'Un agrégat par école : compteurs, jalons et dates, sur l''année scolaire ACTIVE. Aucun nom de personne, aucune ligne de contenu.';

-- `drop` emporte les droits avec l'objet : sans cette ligne, la Régie recevrait
-- un refus de permission sur son écran d'accueil, et le diagnostic partirait
-- chercher du côté du rôle plutôt que du côté de cette migration.
grant select on controle.mv_sante_ecole to regie;


-- ============================================================
-- Le contrôle, qui porte cette fois sur le contenu
-- ============================================================
-- Formulé sans nommer aucune école : est-ce qu'il existe un établissement que
-- la vue annonce à zéro inscription alors qu'il en a dans son année ACTIVE ?
-- Zéro attendu. Compter les lignes de la vue, comme le faisait le contrôle
-- précédent, ne l'aurait pas vu — il y avait bien cinq lignes, toutes fausses.
do $do$
declare
  v_incoherentes int;
  v_total bigint;
begin
  perform controle.rafraichir_agregats(true);

  select count(*) into v_incoherentes
    from controle.mv_sante_ecole mv
   where mv."nbInscriptionsActives" = 0
     and exists (
       select 1 from inscription i
       join annee_scolaire a on a.id = i."anneeScolaireId"
       where i."etablissementId" = mv."etablissementId"
         and i.statut = 'ACTIVE' and a.statut = 'ACTIVE'
     );

  if v_incoherentes > 0 then
    raise exception
      '% école(s) annoncées à zéro inscription alors qu''elles en ont dans leur année ACTIVE.',
      v_incoherentes;
  end if;

  select sum("nbInscriptionsActives") into v_total from controle.mv_sante_ecole;
  raise notice 'Agrégats recalculés : % inscriptions actives, % école(s) à plus d''une année ACTIVE.',
    v_total,
    (select count(*) from controle.mv_sante_ecole where "nbAnneesActives" > 1);
end;
$do$;

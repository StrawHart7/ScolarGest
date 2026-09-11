-- Durcissement : la RLS doit porter les roles, pas seulement le tenant.
--
-- ## Ce qui a ete constate, pas deduit
--
-- Le 2026-09-11, par le chemin reel — client anon plus session d'un Enseignant
-- de demonstration, jamais la cle service-role — six essais sur six ont reussi :
--
--   1. inserer un paiement sur une facture de l'ecole ;
--   2. lire toutes les factures de l'ecole ;
--   3. mettre a jour un tarif scolaire ;
--   4. se promouvoir DIRECTEUR dans `utilisateur` ;
--   5. lire les cles d'idempotence de ses collegues dans `operation_client` ;
--   6. appeler `fn_achever_operation` sur l'operation d'un collegue.
--
-- La cause est structurelle et tient en une phrase : **les gardes de role
-- vivent dans les Server Actions, que l'appelant peut sauter.** L'URL du projet
-- et la cle anon sont dans le bundle client par construction, et un utilisateur
-- connecte detient un jeton valide : il parle a PostgREST directement. La RLS
-- est alors la seule barriere, et elle comparait l'etablissement sans jamais
-- regarder le role. Un enseignant avait donc, en base, les droits d'un
-- comptable.
--
-- `CLAUDE.md` disait deja « s'appuyer sur la seule RLS ne suffit pas ». La
-- reciproque manquait : s'appuyer sur le seul applicatif ne suffit pas non plus.
--
-- ## Ce que cette migration fait, et ce qu'elle ne fait pas
--
-- Elle ferme les ecritures la ou le perimetre est **verifie** : les trois tables
-- d'argent n'ont aucune ecriture directe dans le code (toutes passent par des
-- fonctions SECURITY DEFINER, qui ignorent la RLS), et les deux tables de
-- tarification n'ont qu'un chemin d'ecriture chacune, dont la matrice des
-- permissions donne les roles sans ambiguite.
--
-- Elle **ne touche pas** a `note`, `evaluation`, `inscription`, `eleve`,
-- `responsable`, `eleve_responsable` ni `utilisateur`, qui portent des ecritures
-- directes dont les roles demandent une verification appel par appel. Les
-- resserrer au jugé casserait un ecran legitime sans que rien ne le signale —
-- c'est la deuxieme etape, pas celle-ci.
--
-- `auth_role()` lit `app_metadata.role` du JWT, c'est-a-dire **la meme source
-- verifiee** que `requireRole` cote application. Une politique qui s'appuie
-- dessus est donc exactement aussi fiable que la garde applicative.

-- ---------------------------------------------------------------------------
-- 1. Les trois tables d'argent passent en lecture seule pour le tenant
-- ---------------------------------------------------------------------------
--
-- Verifie avant d'ecrire cette section : aucune des vingt-deux references a
-- `paiement`, `facture_eleve` et `ligne_facture` dans `src/` n'est une
-- ecriture. Tout passe par `fn_enregistrer_paiement`, `fn_annuler_paiement`,
-- `fn_inscrire_eleve`, `fn_modifier_lignes_facture`, `fn_annuler_facture` et
-- `fn_recalculer_statut_facture` — toutes SECURITY DEFINER, donc non soumises
-- aux politiques ci-dessous. Retirer l'ecriture au tenant ne retire donc aucune
-- capacite au produit : elle ne retire que le raccourci qui permettait de
-- contourner les gardes.
--
-- La lecture reste a l'echelle de l'etablissement, telle qu'elle etait : la
-- resserrer par role est le travail de la deuxieme etape, et la confondre avec
-- celui-ci ferait porter a une correction de securite le risque d'une autre.
--
-- Aucune politique d'ecriture n'est recreee, pas meme pour le SUPER_ADMIN : la
-- cle service-role ne passe pas par la RLS, donc les outils de la plateforme
-- (`seed-demo`, cron, webhook FedaPay) continuent d'ecrire. Ce qui disparait,
-- c'est l'ecriture au nom d'un utilisateur — la seule qui etait contournable.

drop policy if exists paiement_tenant on paiement;
create policy paiement_lecture on paiement for select
  using (
    is_super_admin()
    or exists (
      select 1 from facture_eleve f
      where f.id = paiement."factureId"
        and f."etablissementId" = auth_etablissement_id()
    )
  );

drop policy if exists facture_eleve_tenant on facture_eleve;
create policy facture_eleve_lecture on facture_eleve for select
  using (is_super_admin() or "etablissementId" = auth_etablissement_id());

drop policy if exists ligne_facture_tenant on ligne_facture;
create policy ligne_facture_lecture on ligne_facture for select
  using (
    is_super_admin()
    or exists (
      select 1 from facture_eleve f
      where f.id = ligne_facture."factureId"
        and f."etablissementId" = auth_etablissement_id()
    )
  );

comment on table paiement is
  'Lecture seule pour le tenant. Les ecritures passent exclusivement par les fonctions SECURITY DEFINER gardees (fn_enregistrer_paiement, fn_annuler_paiement), seules a porter le controle de role et le journal d''audit.';

-- ---------------------------------------------------------------------------
-- 2. Tarification : l'ecriture revient a la Secretaire et au Comptable
-- ---------------------------------------------------------------------------
--
-- Roles repris de `matrice.instantane.txt`, qui fait foi :
--   tarif.createTarif        = SUPER_ADMIN+SECRETAIRE+COMPTABLE
--   type-frais.createTypeFrais / updateTypeFrais = idem
--
-- Le Directeur lit (`listTarifs`, `listTypesFrais`) mais n'ecrit pas — c'est
-- deja la decision du produit cote service, la base la rejoint.

drop policy if exists tarif_scolaire_tenant on tarif_scolaire;
create policy tarif_scolaire_lecture on tarif_scolaire for select
  using (is_super_admin() or "etablissementId" = auth_etablissement_id());
create policy tarif_scolaire_ecriture on tarif_scolaire for all
  using (
    is_super_admin()
    or ("etablissementId" = auth_etablissement_id()
        and auth_role() in ('SECRETAIRE', 'COMPTABLE'))
  )
  with check (
    is_super_admin()
    or ("etablissementId" = auth_etablissement_id()
        and auth_role() in ('SECRETAIRE', 'COMPTABLE'))
  );

drop policy if exists type_frais_tenant on type_frais;
create policy type_frais_lecture on type_frais for select
  using (is_super_admin() or "etablissementId" = auth_etablissement_id());
create policy type_frais_ecriture on type_frais for all
  using (
    is_super_admin()
    or ("etablissementId" = auth_etablissement_id()
        and auth_role() in ('SECRETAIRE', 'COMPTABLE'))
  )
  with check (
    is_super_admin()
    or ("etablissementId" = auth_etablissement_id()
        and auth_role() in ('SECRETAIRE', 'COMPTABLE'))
  );

-- ---------------------------------------------------------------------------
-- 3. Les cles d'idempotence appartiennent a leur auteur
-- ---------------------------------------------------------------------------
--
-- `operation_client` etait lisible par toute l'ecole, et `fn_achever_operation`
-- comme `fn_abandonner_operation` ne filtraient que sur l'etablissement. La
-- chaine etait complete : un collegue lisait la cle d'une operation en vol,
-- puis l'achevait avec un resultat forge. L'operation reelle n'etait alors
-- jamais executee, et le client lisait « deja fait » — un encaissement en
-- attente disparaissait en annoncant qu'il etait passe.
--
-- La faille n'a pas ete observee jusqu'a l'ecriture : les quatre operations en
-- base etaient achevees, et `resultat is null` a protege l'ecriture. L'appel,
-- lui, a bien ete accepte sans aucun controle d'autorisation. C'est la fenetre
-- d'une operation en attente qui etait exposee, et une file hors ligne n'existe
-- que pour produire cette fenetre.
--
-- Aucun code ne lit cette table directement — les trois RPC sont les seuls
-- acces — donc resserrer la lecture ne retire rien.

drop policy if exists operation_client_tenant on operation_client;
create policy operation_client_lecture on operation_client for select
  using (
    is_super_admin()
    or ("etablissementId" = auth_etablissement_id() and "userId" = auth.uid())
  );

create or replace function fn_achever_operation(p_cle uuid, p_resultat jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_etablissement uuid := auth_etablissement_id();
  v_user uuid := auth.uid();
begin
  -- Refus explicite plutot qu'une comparaison a NULL qui ne correspond a rien :
  -- l'ancienne version etait inoffensive pour un appelant anonyme par accident
  -- — `"etablissementId" = NULL` ne vaut jamais vrai — et non par decision.
  -- Une protection accidentelle se perd a la premiere reecriture.
  if v_etablissement is null or v_user is null then
    raise exception 'Operation hors session: etablissement ou utilisateur inconnu';
  end if;

  -- `userId` en plus de l'etablissement : une reclamation appartient a qui l'a
  -- posee. `executerUneSeuleFois` reclame et acheve dans le meme appel serveur,
  -- donc aucun usage legitime ne traverse deux utilisateurs.
  --
  -- `resultat is null` : une operation achevee ne se reecrit pas, sans quoi un
  -- rejeu tardif ecraserait le resultat deja rendu aux precedents appelants.
  update operation_client
    set resultat = coalesce(p_resultat, '{}'::jsonb)
    where "etablissementId" = v_etablissement
      and "userId" = v_user
      and cle = p_cle
      and resultat is null;
end;
$$;

create or replace function fn_abandonner_operation(p_cle uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_etablissement uuid := auth_etablissement_id();
  v_user uuid := auth.uid();
begin
  if v_etablissement is null or v_user is null then
    raise exception 'Operation hors session: etablissement ou utilisateur inconnu';
  end if;

  -- Meme resserrement : abandonner la reclamation d'un collegue rouvrirait la
  -- fenetre du double encaissement que toute cette table sert a fermer.
  delete from operation_client
    where "etablissementId" = v_etablissement
      and "userId" = v_user
      and cle = p_cle
      and resultat is null;
end;
$$;

-- `fn_reclamer_operation` lit l'operation existante pour rendre son resultat.
-- Scoper cette lecture a l'auteur aussi : a defaut, un collegue inserant la
-- meme cle recevrait le resultat de quelqu'un d'autre — un numero de recu, un
-- identifiant de paiement. L'unicite reste sur `("etablissementId", cle)`,
-- deliberement : c'est elle qui empeche une ecole de pre-reclamer les cles
-- d'une autre.
create or replace function fn_reclamer_operation(p_cle uuid, p_type text)
returns table (rejeu boolean, achevee boolean, resultat jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_etablissement uuid := auth_etablissement_id();
  v_user uuid := auth.uid();
  v_existant operation_client;
begin
  if v_etablissement is null or v_user is null then
    raise exception 'Operation hors session: etablissement ou utilisateur inconnu';
  end if;

  begin
    insert into operation_client ("etablissementId", "userId", cle, type)
    values (v_etablissement, v_user, p_cle, p_type);
    return query select false, false, null::jsonb;
    return;
  exception when unique_violation then
    null;
  end;

  select * into v_existant from operation_client
    where "etablissementId" = v_etablissement and cle = p_cle;

  -- Cle deja prise par quelqu'un d'autre : ce n'est pas un rejeu, et rendre
  -- son resultat divulguerait l'operation d'un collegue.
  if v_existant."userId" is distinct from v_user then
    raise exception 'Cle d''operation % deja utilisee par un autre utilisateur', p_cle;
  end if;

  if v_existant.type is distinct from p_type then
    raise exception 'Cle d''operation % deja utilisee pour le type %', p_cle, v_existant.type;
  end if;

  return query select true, v_existant.resultat is not null, v_existant.resultat;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Les fonctions de maintenance ne sont pas une API publique
-- ---------------------------------------------------------------------------
--
-- Toute fonction du schema `public` est exposee en RPC, et `EXECUTE` y est
-- accorde a `public` par defaut. Deux d'entre elles n'ont rien a y faire : ce
-- sont des taches de maintenance appelees par le cron avec la cle service-role.
--
-- `fn_expirer_abonnements` etait joignable **sans etre connecte** : elle
-- n'expire que des abonnements deja echus, donc le degat est nul, mais une
-- fonction qui ecrit sur toutes les ecoles de la plateforme ne doit pas etre au
-- bout d'une URL anonyme.
--
-- Le diagnostic Supabase signale aussi `fn_limiter_ecoles_fondatrices` et
-- `fn_proteger_facturation`. **Elles sont volontairement laissees en place** :
-- ce sont des fonctions de declencheur, elles renvoient `trigger`, et PostgREST
-- n'expose pas ce type de retour — il n'y a donc pas d'URL a fermer. Leur
-- revoquer `EXECUTE` n'apporterait rien et ferait porter a cette migration le
-- risque d'un declencheur casse pour un avertissement sans objet.

revoke all on function fn_expirer_abonnements() from anon, authenticated;
revoke all on function fn_purger_operations_client() from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. `search_path` fige sur les fonctions qui ne l'avaient pas
-- ---------------------------------------------------------------------------
--
-- Une fonction SECURITY DEFINER dont le `search_path` est mutable resout ses
-- noms de tables selon le chemin de l'appelant : qui peut creer un objet dans
-- un schema place avant `public` fait executer son propre code avec les droits
-- du proprietaire. Le coeur financier et academique est dans la liste
-- (`fn_enregistrer_paiement`, `fn_annuler_paiement`, `fn_modifier_lignes_facture`,
-- `fn_passer_cohorte`, `fn_soumettre_notes`, `fn_valider_soumission`), d'ou
-- l'interet de le fermer meme si l'exploitation demande un privilege que le
-- projet n'accorde pas aujourd'hui. Une protection qui depend d'un reglage
-- ailleurs n'est pas une protection.

alter function auth_etablissement_id()            set search_path = public, pg_catalog;
alter function auth_role()                        set search_path = public, pg_catalog;
alter function is_super_admin()                   set search_path = public, pg_catalog;
alter function touch_updated_at()                 set search_path = public, pg_catalog;
alter function fn_creer_eleve_avec_responsables   set search_path = public, pg_catalog;
alter function fn_lier_responsable_eleve          set search_path = public, pg_catalog;
alter function fn_inscrire_eleve                  set search_path = public, pg_catalog;
alter function fn_passer_cohorte                  set search_path = public, pg_catalog;
alter function fn_creer_enseignant_avec_affectations set search_path = public, pg_catalog;
alter function fn_soumettre_notes                 set search_path = public, pg_catalog;
alter function fn_recalculer_statut_facture        set search_path = public, pg_catalog;
alter function fn_enregistrer_paiement            set search_path = public, pg_catalog;
alter function fn_annuler_paiement                set search_path = public, pg_catalog;
alter function fn_modifier_lignes_facture         set search_path = public, pg_catalog;
alter function fn_annuler_facture                 set search_path = public, pg_catalog;
alter function fn_renouveler_abonnement           set search_path = public, pg_catalog;
alter function fn_valider_soumission              set search_path = public, pg_catalog;
alter function fn_rejeter_soumission              set search_path = public, pg_catalog;

-- ---------------------------------------------------------------------------
-- 6. Le formulaire public de demande de demo est borne
-- ---------------------------------------------------------------------------
--
-- `demande_demo_insert_public` accorde l'insertion a `anon` avec
-- `with check (true)` — c'est voulu, le formulaire de la page d'accueil
-- s'adresse a des visiteurs non connectes, et la lecture reste reservee au
-- SUPER_ADMIN. Mais les colonnes sont en `text` non borne : n'importe qui peut
-- deverser des megaoctets par ligne dans la base, sans compte et sans limite.
--
-- Des bornes de longueur ne remplacent pas une limitation de debit — qui ne
-- s'exprime pas au niveau de la RLS et reste a poser en amont — mais elles
-- transforment un remplissage de disque en simple spam.

alter table demande_demo
  add constraint demande_demo_longueurs check (
    length(coalesce("nomEtablissement", '')) <= 200
    and length(coalesce("nomContact", '')) <= 200
    and length(coalesce(email, '')) <= 320
    and length(coalesce(telephone, '')) <= 40
    and length(coalesce(message, '')) <= 4000
    and length(coalesce(ville, '')) <= 200
  );

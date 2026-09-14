-- Le Directeur peut tout faire dans son établissement.
--
-- Constat de terrain, 2026-09-14, sur une école réelle en test : le Directeur
-- ouvre « Tarifs », voit la page, voit la liste vide, et **il n'y a aucun
-- bouton**. Rien ne lui dit pourquoi. Il conclut que le produit est cassé.
--
-- Trois couches le refusaient à la fois — l'écran masquait l'action, le service
-- gardait `COMPTABLE, SECRETAIRE`, et ces policies nommaient les deux mêmes
-- rôles. Cette migration ouvre la troisième ; les deux autres sont dans le même
-- commit.
--
-- ## Pourquoi c'était incohérent, et pas seulement restrictif
--
-- `facture_eleve_ecriture` autorise déjà le DIRECTEUR depuis `0001`. Il pouvait
-- donc **émettre une facture**, mais ni créer le tarif sur lequel elle
-- s'appuie, ni enregistrer le versement qui la solde. Une porte à moitié
-- ouverte n'est pas une sécurité, c'est un piège : elle laisse commencer un
-- geste qu'elle empêche de finir.
--
-- ## Pourquoi le rôle change, et pas seulement l'écran
--
-- La séparation Directeur / Comptable suppose une école dotée d'un personnel
-- administratif. Sur le terrain togolais, beaucoup d'écoles n'ont qu'un
-- directeur et des enseignants. Exiger un Comptable pour enregistrer un tarif,
-- c'est exiger une personne qui n'existe pas — et le produit devient
-- inutilisable pour la moitié de son marché.
--
-- Le Directeur passe donc juste derrière le SUPER_ADMIN : tout, sur son seul
-- établissement. Les autres rôles ne perdent rien ; ils gardent exactement ce
-- qu'ils avaient, et une école qui a une Secrétaire continue de travailler
-- comme avant.
--
-- ## Ce qui reste fermé, délibérément
--
-- **La saisie des notes.** `saisirNote` garde `ENSEIGNANT`. Un Directeur qui
-- enseigne reçoit un compte enseignant ; c'est ce qui préserve les deux paires
-- d'yeux sur la note d'un élève, puisque c'est lui qui approuve. La policy
-- `note_ecriture` nomme bien le DIRECTEUR — elle doit le faire, l'approbation
-- écrit le statut de la note — mais la garde applicative, elle, reste fermée.
--
-- **Les tableaux de bord des autres rôles.** Le Directeur a le sien.

begin;

-- ---------------------------------------------------------------------------
-- Tarifs et types de frais : la configuration financière de l'école
-- ---------------------------------------------------------------------------

drop policy if exists tarif_scolaire_ecriture on public.tarif_scolaire;
create policy tarif_scolaire_ecriture on public.tarif_scolaire
  for all
  using (
    is_super_admin()
    or (
      "etablissementId" = auth_etablissement_id()
      and auth_role() = any (array['DIRECTEUR', 'SECRETAIRE', 'COMPTABLE'])
    )
  )
  with check (
    is_super_admin()
    or (
      "etablissementId" = auth_etablissement_id()
      and auth_role() = any (array['DIRECTEUR', 'SECRETAIRE', 'COMPTABLE'])
    )
  );

drop policy if exists type_frais_ecriture on public.type_frais;
create policy type_frais_ecriture on public.type_frais
  for all
  using (
    is_super_admin()
    or (
      "etablissementId" = auth_etablissement_id()
      and auth_role() = any (array['DIRECTEUR', 'SECRETAIRE', 'COMPTABLE'])
    )
  )
  with check (
    is_super_admin()
    or (
      "etablissementId" = auth_etablissement_id()
      and auth_role() = any (array['DIRECTEUR', 'SECRETAIRE', 'COMPTABLE'])
    )
  );

-- ---------------------------------------------------------------------------
-- Paiements
-- ---------------------------------------------------------------------------
--
-- `fn_enregistrer_paiement` est `security invoker` : elle s'exécute sous la RLS
-- de l'appelant, et c'est donc bien cette policy qui décide. Elle fait en plus
-- un `select ... for update` sur la facture — évalué contre la policy d'UPDATE
-- de `facture_eleve`, pas celle de SELECT. Le DIRECTEUR y figure depuis
-- toujours, la lecture verrouillante passe ; c'est le piège qui avait rendu une
-- facture « introuvable » le 2026-09-11, il est vérifié et non supposé.

drop policy if exists paiement_ecriture on public.paiement;
create policy paiement_ecriture on public.paiement
  for all
  using (
    is_super_admin()
    or (
      auth_role() = any (array['DIRECTEUR', 'SECRETAIRE', 'COMPTABLE'])
      and exists (
        select 1 from public.facture_eleve f
         where f.id = paiement."factureId"
           and f."etablissementId" = auth_etablissement_id()
      )
    )
  )
  with check (
    is_super_admin()
    or (
      auth_role() = any (array['DIRECTEUR', 'SECRETAIRE', 'COMPTABLE'])
      and exists (
        select 1 from public.facture_eleve f
         where f.id = paiement."factureId"
           and f."etablissementId" = auth_etablissement_id()
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Auto-contrôle
-- ---------------------------------------------------------------------------
--
-- Structurel, pas fonctionnel : la preuve par le chemin réel est
-- `scripts/verifier-separation-roles.ts`, qui monte de vraies sessions. Ce bloc
-- attrape ce qu'une relecture rate — une policy recréée en oubliant un rôle, ou
-- en laissant entrer l'Enseignant dans la caisse.

do $$
declare
  v_nom text;
  v_texte text;
begin
  foreach v_nom in array array['tarif_scolaire_ecriture', 'type_frais_ecriture', 'paiement_ecriture']
  loop
    select coalesce(qual, '') || ' ' || coalesce(with_check, '')
      into v_texte
      from pg_policies
     where schemaname = 'public' and policyname = v_nom;

    if v_texte is null then
      raise exception 'Policy % introuvable apres recreation.', v_nom;
    end if;
    if v_texte not like '%DIRECTEUR%' then
      raise exception 'Policy % : le DIRECTEUR n''y figure pas, la migration n''a rien ouvert.', v_nom;
    end if;
    if v_texte not like '%SECRETAIRE%' or v_texte not like '%COMPTABLE%' then
      raise exception 'Policy % : un role existant a ete perdu en chemin.', v_nom;
    end if;
    if v_texte like '%ENSEIGNANT%' then
      raise exception 'Policy % : l''Enseignant ne doit jamais ecrire ici.', v_nom;
    end if;
    if v_texte not like '%auth_etablissement_id()%' then
      raise exception 'Policy % : l''isolation entre ecoles a disparu.', v_nom;
    end if;
  end loop;
end $$;

commit;

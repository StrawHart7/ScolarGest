-- Correctif : rendre l'ecriture financiere aux roles qui en ont besoin.
--
-- ## L'erreur que cette migration repare
--
-- `20260911005324` a retire toute politique d'ecriture sur `paiement`,
-- `facture_eleve` et `ligne_facture`, au motif ecrit noir sur blanc dans son
-- propre commentaire : « tout passe par des fonctions SECURITY DEFINER, qui
-- ignorent la RLS ».
--
-- **C'etait faux, et ce n'avait pas ete verifie.** Sur les vingt et une
-- fonctions `fn_*` du schema, seules les sept fonctions d'operation et de
-- maintenance sont SECURITY DEFINER. Tout le metier — `fn_enregistrer_paiement`,
-- `fn_annuler_paiement`, `fn_inscrire_eleve`, `fn_modifier_lignes_facture`,
-- `fn_annuler_facture`, `fn_recalculer_statut_facture` — est SECURITY INVOKER,
-- donc soumis a la RLS de l'appelant.
--
-- L'absence d'ecriture directe depuis `src/` avait bien ete constatee ; c'est
-- d'en avoir deduit que la RLS ne s'appliquait pas qui etait une deduction
-- prise pour une verification.
--
-- Consequence observee par le controle positif, session d'une Secretaire :
-- « Facture introuvable ». Le `select ... for update` de
-- `fn_enregistrer_paiement` est une lecture **verrouillante** : sous RLS, elle
-- est evaluee contre la politique d'UPDATE, pas celle de SELECT. Sans politique
-- d'ecriture, elle ne ramene aucune ligne, et la fonction conclut que la
-- facture n'existe pas. Les encaissements etaient casses.
--
-- ## Ce que fait le correctif
--
-- Il rend l'ecriture, mais **par role** plutot qu'a tout l'etablissement —
-- l'objectif initial, atteint cette fois par le bon moyen. Les roles viennent
-- de `matrice.instantane.txt`, qui fait foi :
--
--   paiement.enregistrerPaiement / annulerPaiement = SECRETAIRE + COMPTABLE
--   facture.annulerFacture / modifierLignesFacture = SECRETAIRE + COMPTABLE
--   inscription.creerInscriptionAvecFacture        = DIRECTEUR + SECRETAIRE
--   inscription.reinscrireEleve                    = DIRECTEUR + SECRETAIRE
--
-- `fn_inscrire_eleve` insere une facture et ses lignes : le Directeur doit donc
-- pouvoir ecrire sur `facture_eleve` et `ligne_facture`, mais pas sur
-- `paiement`, qu'il ne touche par aucun chemin.
--
-- L'ENSEIGNANT n'ecrit sur aucune des trois. C'est le trou constate le
-- 2026-09-11 — un enseignant inserant un paiement par appel direct a
-- PostgREST — et il reste ferme.

-- --------------------------------------------------------------- paiement --
create policy paiement_ecriture on paiement for all
  using (
    is_super_admin()
    or (
      auth_role() in ('SECRETAIRE', 'COMPTABLE')
      and exists (
        select 1 from facture_eleve f
        where f.id = paiement."factureId"
          and f."etablissementId" = auth_etablissement_id()
      )
    )
  )
  with check (
    is_super_admin()
    or (
      auth_role() in ('SECRETAIRE', 'COMPTABLE')
      and exists (
        select 1 from facture_eleve f
        where f.id = paiement."factureId"
          and f."etablissementId" = auth_etablissement_id()
      )
    )
  );

-- ---------------------------------------------------------- facture_eleve --
-- Le Directeur y figure par la chaine d'inscription, pas par la finance.
create policy facture_eleve_ecriture on facture_eleve for all
  using (
    is_super_admin()
    or (
      auth_role() in ('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE')
      and "etablissementId" = auth_etablissement_id()
    )
  )
  with check (
    is_super_admin()
    or (
      auth_role() in ('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE')
      and "etablissementId" = auth_etablissement_id()
    )
  );

-- ---------------------------------------------------------- ligne_facture --
create policy ligne_facture_ecriture on ligne_facture for all
  using (
    is_super_admin()
    or (
      auth_role() in ('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE')
      and exists (
        select 1 from facture_eleve f
        where f.id = ligne_facture."factureId"
          and f."etablissementId" = auth_etablissement_id()
      )
    )
  )
  with check (
    is_super_admin()
    or (
      auth_role() in ('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE')
      and exists (
        select 1 from facture_eleve f
        where f.id = ligne_facture."factureId"
          and f."etablissementId" = auth_etablissement_id()
      )
    )
  );

comment on table paiement is
  'Ecriture reservee a SECRETAIRE et COMPTABLE, y compris par appel direct a PostgREST : les fonctions fn_enregistrer_paiement et fn_annuler_paiement sont SECURITY INVOKER, donc soumises a cette politique. Ne pas la retirer en croyant que les RPC suffisent.';

-- Les deux tables de tarification avaient ete resserrees a SECRETAIRE et
-- COMPTABLE par la migration precedente. `fn_inscrire_eleve` les **lit**
-- seulement (boucle sur `tarif_scolaire` joint a `type_frais`), et la lecture
-- est restee ouverte a tout l'etablissement : la chaine d'inscription du
-- Directeur n'est donc pas affectee. Verifie sur la definition de la fonction,
-- pas suppose — c'est exactement la verification qui manquait la premiere fois.

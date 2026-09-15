-- Hisser les appels d'authentification hors de la boucle par ligne,
-- et cesser de payer les politiques d'ecriture sur les lectures.
--
-- =====================================================================
-- L'INCIDENT
-- =====================================================================
--
-- Le 2026-09-15, /dashboard rendait « Une erreur est survenue ». Le journal de
-- la passerelle montrait des 500 sur la seule table `note` ; le journal
-- Postgres disait « canceling statement due to statement timeout ».
--
-- La requete rejouee sous l'identite reelle d'un Directeur :
--
--   Seq Scan on note  (actual time=23303..23303 rows=0)
--     Filter: (is_super_admin() OR ... OR is_super_admin() OR ...)
--             AND (statut = 'EN_ATTENTE')
--     Rows Removed by Filter: 28132
--     Buffers: shared hit=507
--
-- 23,3 secondes pour rendre zero ligne. 507 buffers seulement : ce n'est pas
-- de l'I/O, c'est du CPU passe a rejouer `is_super_admin()` sur chacune des
-- 28 132 lignes. Cette fonction relit et reparse le JWT a chaque appel.
--
-- =====================================================================
-- DEUX DEFAUTS, ET ILS SE MULTIPLIENT
-- =====================================================================
--
-- 1. `auth_*()` est reevalue ligne a ligne. Ces fonctions sont STABLE et sans
--    argument : leur resultat est le meme pour toute la requete. Mais placees
--    dans un `OR` a cote d'un `EXISTS` correle, le planificateur ne peut pas
--    les sortir de la boucle. `(select is_super_admin())` l'y force : Postgres
--    en fait un InitPlan, evalue une seule fois. C'est le correctif documente
--    par Supabase (lint `auth_rls_initplan`), et l'auditeur du projet le
--    signale.
--
--    `est_affecte(...)` n'est PAS enveloppee : elle prend des arguments qui
--    varient d'une ligne a l'autre, elle ne peut donc pas etre hissee.
--    L'envelopper changerait le sens, pas la vitesse.
--
-- 2. Les politiques d'ecriture sont en `FOR ALL`, donc jouees sur les
--    lectures. Douze tables portent le couple `_lecture` (SELECT) +
--    `_ecriture` (ALL). Une simple lecture evalue les deux, et tout le travail
--    est fait deux fois. C'est le lint `multiple_permissive_policies`, signale
--    sur exactement ces douze tables.
--
-- =====================================================================
-- POURQUOI CE DECOUPAGE NE CHANGE AUCUN ACCES
-- =====================================================================
--
-- Retirer SELECT d'une politique permissive ne restreint que si cette
-- politique laissait passer des lignes que l'autre refuse. Or, sur les douze
-- tables, `_ecriture` est strictement plus etroite que `_lecture` : elle
-- reprend la meme condition d'etablissement et y AJOUTE une condition de role.
-- Leur union vaut donc `_lecture`, et `_lecture` seule donne exactement la
-- meme visibilite. Verifie expression par expression avant d'ecrire ce
-- fichier.
--
-- Les autres politiques `FOR ALL` du schema — `classe_tenant`,
-- `annee_scolaire_tenant`, `matiere_tenant` et les autres `*_tenant` — ne sont
-- PAS touchees dans leur portee : elles sont la SEULE politique de leur table,
-- et leur retirer SELECT rendrait la table invisible. Elles ne recoivent ici
-- que l'enveloppe `(select ...)`.
--
-- =====================================================================
-- CE QUE CETTE MIGRATION NE FAIT PAS
-- =====================================================================
--
-- Elle ne touche ni les roles nommes, ni les conditions d'etablissement, ni
-- `est_affecte`. Aucune ligne ne devient visible ou ecrivable pour quelqu'un
-- qui ne l'avait pas. Les deux sondes du depot le verifient apres coup :
-- `scripts/verifier-separation-roles.ts` et `scripts/verifier-isolation.ts`.
--
-- Elle n'ajoute AUCUN index. La tentation etait d'en poser un sur
-- (statut, "evaluationId") de `note`. Mais l'index partiel `idx_note_a_traiter`
-- existe deja, et rien ne dit qu'il restait inutilise pour une autre raison que
-- le cout du filtre. On mesure d'abord avec la politique hissee ; poser un
-- index sur une hypothese, c'est payer une ecriture de plus a chaque saisie de
-- note pour un gain qu'on n'a pas constate.

-- ---------------------------------------------------------------------
-- 1. Les politiques « tenant » : enveloppe seule, portee inchangee
-- ---------------------------------------------------------------------

alter policy affectation_enseignant_tenant on affectation_enseignant
  using ((select is_super_admin()) or "etablissementId" = (select auth_etablissement_id()))
  with check ((select is_super_admin()) or "etablissementId" = (select auth_etablissement_id()));

alter policy annee_scolaire_tenant on annee_scolaire
  using ((select is_super_admin()) or "etablissementId" = (select auth_etablissement_id()))
  with check ((select is_super_admin()) or "etablissementId" = (select auth_etablissement_id()));

alter policy classe_tenant on classe
  using ((select is_super_admin()) or "etablissementId" = (select auth_etablissement_id()))
  with check ((select is_super_admin()) or "etablissementId" = (select auth_etablissement_id()));

alter policy cycle_etablissement_tenant on cycle_etablissement
  using ((select is_super_admin()) or "etablissementId" = (select auth_etablissement_id()))
  with check ((select is_super_admin()) or "etablissementId" = (select auth_etablissement_id()));

alter policy document_tenant on document
  using ((select is_super_admin()) or "etablissementId" = (select auth_etablissement_id()))
  with check ((select is_super_admin()) or "etablissementId" = (select auth_etablissement_id()));

alter policy emploi_du_temps_tenant on emploi_du_temps_creneau
  using ((select is_super_admin()) or "etablissementId" = (select auth_etablissement_id()))
  with check ((select is_super_admin()) or "etablissementId" = (select auth_etablissement_id()));

alter policy enseignant_tenant on enseignant
  using ((select is_super_admin()) or "etablissementId" = (select auth_etablissement_id()))
  with check ((select is_super_admin()) or "etablissementId" = (select auth_etablissement_id()));

alter policy etablissement_tenant on etablissement
  using ((select is_super_admin()) or id = (select auth_etablissement_id()))
  with check ((select is_super_admin()) or id = (select auth_etablissement_id()));

alter policy matiere_tenant on matiere
  using ((select is_super_admin()) or "etablissementId" = (select auth_etablissement_id()))
  with check ((select is_super_admin()) or "etablissementId" = (select auth_etablissement_id()));

alter policy onboarding_progression_tenant on onboarding_progression
  using ((select is_super_admin()) or "etablissementId" = (select auth_etablissement_id()))
  with check ((select is_super_admin()) or "etablissementId" = (select auth_etablissement_id()));

alter policy parametres_document_tenant on parametres_document
  using ((select is_super_admin()) or "etablissementId" = (select auth_etablissement_id()))
  with check ((select is_super_admin()) or "etablissementId" = (select auth_etablissement_id()));

alter policy programme_etablissement_tenant on programme_etablissement
  using ((select is_super_admin()) or "etablissementId" = (select auth_etablissement_id()))
  with check ((select is_super_admin()) or "etablissementId" = (select auth_etablissement_id()));

alter policy coefficient_matiere_tenant on coefficient_matiere
  using (
    (select is_super_admin())
    or exists (
      select 1 from programme_etablissement p
      where p.id = coefficient_matiere."programmeEtablissementId"
        and p."etablissementId" = (select auth_etablissement_id())
    )
  )
  with check (
    (select is_super_admin())
    or exists (
      select 1 from programme_etablissement p
      where p.id = coefficient_matiere."programmeEtablissementId"
        and p."etablissementId" = (select auth_etablissement_id())
    )
  );

alter policy titularite_classe_tenant on titularite_classe
  using (
    (select is_super_admin())
    or exists (
      select 1 from classe c
      where c.id = titularite_classe."classeId"
        and c."etablissementId" = (select auth_etablissement_id())
    )
  )
  with check (
    (select is_super_admin())
    or exists (
      select 1 from classe c
      where c.id = titularite_classe."classeId"
        and c."etablissementId" = (select auth_etablissement_id())
    )
  );

alter policy conseil_utilisateur_personnel on conseil_utilisateur
  using (
    (select is_super_admin())
    or ("etablissementId" = (select auth_etablissement_id())
        and "utilisateurId" = (select auth.uid()))
  )
  with check (
    (select is_super_admin())
    or ("etablissementId" = (select auth_etablissement_id())
        and "utilisateurId" = (select auth.uid()))
  );

-- ---------------------------------------------------------------------
-- 2. Les politiques mono-commande : enveloppe
-- ---------------------------------------------------------------------

alter policy abonnement_etablissement_read on abonnement_etablissement
  using ((select is_super_admin()) or "etablissementId" = (select auth_etablissement_id()));

alter policy abonnement_etablissement_update_super_admin on abonnement_etablissement
  using ((select is_super_admin()));

alter policy abonnement_etablissement_write_super_admin on abonnement_etablissement
  with check ((select is_super_admin()));

alter policy audit_log_read on audit_log
  using ((select is_super_admin()) or "etablissementId" = (select auth_etablissement_id()));

alter policy audit_log_insert on audit_log
  with check ((select is_super_admin()) or "etablissementId" = (select auth_etablissement_id()));

alter policy annonce_lue_lecture on annonce_lue
  using ("userId" = (select auth.uid()));

alter policy annonce_lue_ecriture on annonce_lue
  with check ("userId" = (select auth.uid())
              and "etablissementId" = (select auth_etablissement_id()));

alter policy cycle_update_super_admin on cycle using ((select is_super_admin()));
alter policy cycle_write_super_admin on cycle with check ((select is_super_admin()));

alter policy demande_demo_read_super_admin on demande_demo using ((select is_super_admin()));
alter policy demande_demo_update_super_admin on demande_demo using ((select is_super_admin()));

alter policy drapeau_etablissement_lecture on drapeau_etablissement
  using ("etablissementId" = (select auth_etablissement_id()) or (select is_super_admin()));

alter policy niveau_update_super_admin on niveau using ((select is_super_admin()));
alter policy niveau_write_super_admin on niveau with check ((select is_super_admin()));

alter policy operation_client_lecture on operation_client
  using (
    (select is_super_admin())
    or ("etablissementId" = (select auth_etablissement_id())
        and "userId" = (select auth.uid()))
  );

alter policy operation_client_insertion on operation_client
  with check (
    (select is_super_admin())
    or ("etablissementId" = (select auth_etablissement_id())
        and "userId" = (select auth.uid()))
  );

alter policy paiement_abonnement_read on paiement_abonnement
  using (
    (select is_super_admin())
    or exists (
      select 1 from abonnement_etablissement a
      where a.id = paiement_abonnement."abonnementId"
        and a."etablissementId" = (select auth_etablissement_id())
    )
  );

alter policy paiement_abonnement_write_super_admin on paiement_abonnement
  with check ((select is_super_admin()));

alter policy plan_abonnement_update_super_admin on plan_abonnement using ((select is_super_admin()));
alter policy plan_abonnement_write_super_admin on plan_abonnement with check ((select is_super_admin()));

alter policy relance_read on relance_abonnement
  using ((select is_super_admin()) or "etablissementId" = (select auth_etablissement_id()));

alter policy serie_update_super_admin on serie using ((select is_super_admin()));
alter policy serie_write_super_admin on serie with check ((select is_super_admin()));

alter policy support_demande_select on support_demande
  using (
    (select is_super_admin())
    or ("etablissementId" = (select auth_etablissement_id())
        and "auteurId" = (select auth.uid()))
  );

alter policy support_demande_insert_tenant on support_demande
  with check ("etablissementId" = (select auth_etablissement_id())
             and "auteurId" = (select auth.uid()));

alter policy support_demande_update_super_admin on support_demande
  using ((select is_super_admin()))
  with check ((select is_super_admin()));

alter policy transaction_fedapay_lecture on transaction_fedapay
  using ((select is_super_admin()) or "etablissementId" = (select auth_etablissement_id()));

-- ---------------------------------------------------------------------
-- 3. Les douze couples lecture / ecriture
--
-- La politique de lecture recoit l'enveloppe. La politique d'ecriture, elle,
-- quitte `FOR ALL` pour trois politiques nommement INSERT, UPDATE et DELETE :
-- une lecture cesse alors de l'evaluer.
--
-- `select ... for update` est evalue contre la politique d'UPDATE, pas celle
-- de SELECT — piege deja paye ici le 2026-09-11, quand
-- `fn_enregistrer_paiement` repondait « Facture introuvable » sur une facture
-- parfaitement lisible. C'est pourquoi la politique UPDATE garde exactement le
-- meme `using` que l'ancienne politique `ALL`.
-- ---------------------------------------------------------------------

-- eleve ---------------------------------------------------------------
alter policy eleve_lecture on eleve
  using ((select is_super_admin()) or "etablissementId" = (select auth_etablissement_id()));

drop policy if exists eleve_ecriture on eleve;

create policy eleve_insertion on eleve for insert with check (
  (select is_super_admin())
  or ("etablissementId" = (select auth_etablissement_id())
      and (select auth_role()) = any (array['DIRECTEUR', 'SECRETAIRE']))
);
create policy eleve_modification on eleve for update
  using (
    (select is_super_admin())
    or ("etablissementId" = (select auth_etablissement_id())
        and (select auth_role()) = any (array['DIRECTEUR', 'SECRETAIRE']))
  )
  with check (
    (select is_super_admin())
    or ("etablissementId" = (select auth_etablissement_id())
        and (select auth_role()) = any (array['DIRECTEUR', 'SECRETAIRE']))
  );
create policy eleve_suppression on eleve for delete using (
  (select is_super_admin())
  or ("etablissementId" = (select auth_etablissement_id())
      and (select auth_role()) = any (array['DIRECTEUR', 'SECRETAIRE']))
);

-- responsable ---------------------------------------------------------
alter policy responsable_lecture on responsable
  using ((select is_super_admin()) or "etablissementId" = (select auth_etablissement_id()));

drop policy if exists responsable_ecriture on responsable;

create policy responsable_insertion on responsable for insert with check (
  (select is_super_admin())
  or ("etablissementId" = (select auth_etablissement_id())
      and (select auth_role()) = any (array['DIRECTEUR', 'SECRETAIRE']))
);
create policy responsable_modification on responsable for update
  using (
    (select is_super_admin())
    or ("etablissementId" = (select auth_etablissement_id())
        and (select auth_role()) = any (array['DIRECTEUR', 'SECRETAIRE']))
  )
  with check (
    (select is_super_admin())
    or ("etablissementId" = (select auth_etablissement_id())
        and (select auth_role()) = any (array['DIRECTEUR', 'SECRETAIRE']))
  );
create policy responsable_suppression on responsable for delete using (
  (select is_super_admin())
  or ("etablissementId" = (select auth_etablissement_id())
      and (select auth_role()) = any (array['DIRECTEUR', 'SECRETAIRE']))
);

-- inscription ---------------------------------------------------------
alter policy inscription_lecture on inscription
  using ((select is_super_admin()) or "etablissementId" = (select auth_etablissement_id()));

drop policy if exists inscription_ecriture on inscription;

create policy inscription_insertion on inscription for insert with check (
  (select is_super_admin())
  or ("etablissementId" = (select auth_etablissement_id())
      and (select auth_role()) = any (array['DIRECTEUR', 'SECRETAIRE']))
);
create policy inscription_modification on inscription for update
  using (
    (select is_super_admin())
    or ("etablissementId" = (select auth_etablissement_id())
        and (select auth_role()) = any (array['DIRECTEUR', 'SECRETAIRE']))
  )
  with check (
    (select is_super_admin())
    or ("etablissementId" = (select auth_etablissement_id())
        and (select auth_role()) = any (array['DIRECTEUR', 'SECRETAIRE']))
  );
create policy inscription_suppression on inscription for delete using (
  (select is_super_admin())
  or ("etablissementId" = (select auth_etablissement_id())
      and (select auth_role()) = any (array['DIRECTEUR', 'SECRETAIRE']))
);

-- eleve_responsable ---------------------------------------------------
alter policy eleve_responsable_lecture on eleve_responsable
  using (
    (select is_super_admin())
    or exists (
      select 1 from eleve e
      where e.id = eleve_responsable."eleveId"
        and e."etablissementId" = (select auth_etablissement_id())
    )
  );

drop policy if exists eleve_responsable_ecriture on eleve_responsable;

create policy eleve_responsable_insertion on eleve_responsable for insert with check (
  (select is_super_admin())
  or ((select auth_role()) = any (array['DIRECTEUR', 'SECRETAIRE'])
      and exists (
        select 1 from eleve e
        where e.id = eleve_responsable."eleveId"
          and e."etablissementId" = (select auth_etablissement_id())
      ))
);
create policy eleve_responsable_modification on eleve_responsable for update
  using (
    (select is_super_admin())
    or ((select auth_role()) = any (array['DIRECTEUR', 'SECRETAIRE'])
        and exists (
          select 1 from eleve e
          where e.id = eleve_responsable."eleveId"
            and e."etablissementId" = (select auth_etablissement_id())
        ))
  )
  with check (
    (select is_super_admin())
    or ((select auth_role()) = any (array['DIRECTEUR', 'SECRETAIRE'])
        and exists (
          select 1 from eleve e
          where e.id = eleve_responsable."eleveId"
            and e."etablissementId" = (select auth_etablissement_id())
        ))
  );
create policy eleve_responsable_suppression on eleve_responsable for delete using (
  (select is_super_admin())
  or ((select auth_role()) = any (array['DIRECTEUR', 'SECRETAIRE'])
      and exists (
        select 1 from eleve e
        where e.id = eleve_responsable."eleveId"
          and e."etablissementId" = (select auth_etablissement_id())
      ))
);

-- type_frais ----------------------------------------------------------
alter policy type_frais_lecture on type_frais
  using ((select is_super_admin()) or "etablissementId" = (select auth_etablissement_id()));

drop policy if exists type_frais_ecriture on type_frais;

create policy type_frais_insertion on type_frais for insert with check (
  (select is_super_admin())
  or ("etablissementId" = (select auth_etablissement_id())
      and (select auth_role()) = any (array['DIRECTEUR', 'SECRETAIRE', 'COMPTABLE']))
);
create policy type_frais_modification on type_frais for update
  using (
    (select is_super_admin())
    or ("etablissementId" = (select auth_etablissement_id())
        and (select auth_role()) = any (array['DIRECTEUR', 'SECRETAIRE', 'COMPTABLE']))
  )
  with check (
    (select is_super_admin())
    or ("etablissementId" = (select auth_etablissement_id())
        and (select auth_role()) = any (array['DIRECTEUR', 'SECRETAIRE', 'COMPTABLE']))
  );
create policy type_frais_suppression on type_frais for delete using (
  (select is_super_admin())
  or ("etablissementId" = (select auth_etablissement_id())
      and (select auth_role()) = any (array['DIRECTEUR', 'SECRETAIRE', 'COMPTABLE']))
);

-- tarif_scolaire ------------------------------------------------------
alter policy tarif_scolaire_lecture on tarif_scolaire
  using ((select is_super_admin()) or "etablissementId" = (select auth_etablissement_id()));

drop policy if exists tarif_scolaire_ecriture on tarif_scolaire;

create policy tarif_scolaire_insertion on tarif_scolaire for insert with check (
  (select is_super_admin())
  or ("etablissementId" = (select auth_etablissement_id())
      and (select auth_role()) = any (array['DIRECTEUR', 'SECRETAIRE', 'COMPTABLE']))
);
create policy tarif_scolaire_modification on tarif_scolaire for update
  using (
    (select is_super_admin())
    or ("etablissementId" = (select auth_etablissement_id())
        and (select auth_role()) = any (array['DIRECTEUR', 'SECRETAIRE', 'COMPTABLE']))
  )
  with check (
    (select is_super_admin())
    or ("etablissementId" = (select auth_etablissement_id())
        and (select auth_role()) = any (array['DIRECTEUR', 'SECRETAIRE', 'COMPTABLE']))
  );
create policy tarif_scolaire_suppression on tarif_scolaire for delete using (
  (select is_super_admin())
  or ("etablissementId" = (select auth_etablissement_id())
      and (select auth_role()) = any (array['DIRECTEUR', 'SECRETAIRE', 'COMPTABLE']))
);

-- facture_eleve -------------------------------------------------------
alter policy facture_eleve_lecture on facture_eleve
  using ((select is_super_admin()) or "etablissementId" = (select auth_etablissement_id()));

drop policy if exists facture_eleve_ecriture on facture_eleve;

create policy facture_eleve_insertion on facture_eleve for insert with check (
  (select is_super_admin())
  or ((select auth_role()) = any (array['DIRECTEUR', 'SECRETAIRE', 'COMPTABLE'])
      and "etablissementId" = (select auth_etablissement_id()))
);
create policy facture_eleve_modification on facture_eleve for update
  using (
    (select is_super_admin())
    or ((select auth_role()) = any (array['DIRECTEUR', 'SECRETAIRE', 'COMPTABLE'])
        and "etablissementId" = (select auth_etablissement_id()))
  )
  with check (
    (select is_super_admin())
    or ((select auth_role()) = any (array['DIRECTEUR', 'SECRETAIRE', 'COMPTABLE'])
        and "etablissementId" = (select auth_etablissement_id()))
  );
create policy facture_eleve_suppression on facture_eleve for delete using (
  (select is_super_admin())
  or ((select auth_role()) = any (array['DIRECTEUR', 'SECRETAIRE', 'COMPTABLE'])
      and "etablissementId" = (select auth_etablissement_id()))
);

-- ligne_facture -------------------------------------------------------
alter policy ligne_facture_lecture on ligne_facture
  using (
    (select is_super_admin())
    or exists (
      select 1 from facture_eleve f
      where f.id = ligne_facture."factureId"
        and f."etablissementId" = (select auth_etablissement_id())
    )
  );

drop policy if exists ligne_facture_ecriture on ligne_facture;

create policy ligne_facture_insertion on ligne_facture for insert with check (
  (select is_super_admin())
  or ((select auth_role()) = any (array['DIRECTEUR', 'SECRETAIRE', 'COMPTABLE'])
      and exists (
        select 1 from facture_eleve f
        where f.id = ligne_facture."factureId"
          and f."etablissementId" = (select auth_etablissement_id())
      ))
);
create policy ligne_facture_modification on ligne_facture for update
  using (
    (select is_super_admin())
    or ((select auth_role()) = any (array['DIRECTEUR', 'SECRETAIRE', 'COMPTABLE'])
        and exists (
          select 1 from facture_eleve f
          where f.id = ligne_facture."factureId"
            and f."etablissementId" = (select auth_etablissement_id())
        ))
  )
  with check (
    (select is_super_admin())
    or ((select auth_role()) = any (array['DIRECTEUR', 'SECRETAIRE', 'COMPTABLE'])
        and exists (
          select 1 from facture_eleve f
          where f.id = ligne_facture."factureId"
            and f."etablissementId" = (select auth_etablissement_id())
        ))
  );
create policy ligne_facture_suppression on ligne_facture for delete using (
  (select is_super_admin())
  or ((select auth_role()) = any (array['DIRECTEUR', 'SECRETAIRE', 'COMPTABLE'])
      and exists (
        select 1 from facture_eleve f
        where f.id = ligne_facture."factureId"
          and f."etablissementId" = (select auth_etablissement_id())
      ))
);

-- paiement ------------------------------------------------------------
alter policy paiement_lecture on paiement
  using (
    (select is_super_admin())
    or exists (
      select 1 from facture_eleve f
      where f.id = paiement."factureId"
        and f."etablissementId" = (select auth_etablissement_id())
    )
  );

drop policy if exists paiement_ecriture on paiement;

create policy paiement_insertion on paiement for insert with check (
  (select is_super_admin())
  or ((select auth_role()) = any (array['DIRECTEUR', 'SECRETAIRE', 'COMPTABLE'])
      and exists (
        select 1 from facture_eleve f
        where f.id = paiement."factureId"
          and f."etablissementId" = (select auth_etablissement_id())
      ))
);
create policy paiement_modification on paiement for update
  using (
    (select is_super_admin())
    or ((select auth_role()) = any (array['DIRECTEUR', 'SECRETAIRE', 'COMPTABLE'])
        and exists (
          select 1 from facture_eleve f
          where f.id = paiement."factureId"
            and f."etablissementId" = (select auth_etablissement_id())
        ))
  )
  with check (
    (select is_super_admin())
    or ((select auth_role()) = any (array['DIRECTEUR', 'SECRETAIRE', 'COMPTABLE'])
        and exists (
          select 1 from facture_eleve f
          where f.id = paiement."factureId"
            and f."etablissementId" = (select auth_etablissement_id())
        ))
  );
create policy paiement_suppression on paiement for delete using (
  (select is_super_admin())
  or ((select auth_role()) = any (array['DIRECTEUR', 'SECRETAIRE', 'COMPTABLE'])
      and exists (
        select 1 from facture_eleve f
        where f.id = paiement."factureId"
          and f."etablissementId" = (select auth_etablissement_id())
      ))
);

-- evaluation ----------------------------------------------------------
alter policy evaluation_lecture on evaluation
  using (
    (select is_super_admin())
    or exists (
      select 1 from classe c
      where c.id = evaluation."classeId"
        and c."etablissementId" = (select auth_etablissement_id())
    )
  );

drop policy if exists evaluation_ecriture on evaluation;

create policy evaluation_insertion on evaluation for insert with check (
  (select is_super_admin())
  or exists (
    select 1 from classe c
    where c.id = evaluation."classeId"
      and c."etablissementId" = (select auth_etablissement_id())
      and ((select auth_role()) = any (array['DIRECTEUR', 'SECRETAIRE'])
           or ((select auth_role()) = 'ENSEIGNANT'
               and est_affecte(evaluation."classeId", evaluation."matiereId", evaluation."anneeScolaireId")))
  )
);
create policy evaluation_modification on evaluation for update
  using (
    (select is_super_admin())
    or exists (
      select 1 from classe c
      where c.id = evaluation."classeId"
        and c."etablissementId" = (select auth_etablissement_id())
        and ((select auth_role()) = any (array['DIRECTEUR', 'SECRETAIRE'])
             or ((select auth_role()) = 'ENSEIGNANT'
                 and est_affecte(evaluation."classeId", evaluation."matiereId", evaluation."anneeScolaireId")))
    )
  )
  with check (
    (select is_super_admin())
    or exists (
      select 1 from classe c
      where c.id = evaluation."classeId"
        and c."etablissementId" = (select auth_etablissement_id())
        and ((select auth_role()) = any (array['DIRECTEUR', 'SECRETAIRE'])
             or ((select auth_role()) = 'ENSEIGNANT'
                 and est_affecte(evaluation."classeId", evaluation."matiereId", evaluation."anneeScolaireId")))
    )
  );
create policy evaluation_suppression on evaluation for delete using (
  (select is_super_admin())
  or exists (
    select 1 from classe c
    where c.id = evaluation."classeId"
      and c."etablissementId" = (select auth_etablissement_id())
      and ((select auth_role()) = any (array['DIRECTEUR', 'SECRETAIRE'])
           or ((select auth_role()) = 'ENSEIGNANT'
               and est_affecte(evaluation."classeId", evaluation."matiereId", evaluation."anneeScolaireId")))
  )
);

-- note ----------------------------------------------------------------
-- La table qui a fait tomber /dashboard : 28 132 lignes, et la politique
-- evaluee ligne a ligne, deux fois.
alter policy note_lecture on note
  using (
    (select is_super_admin())
    or exists (
      select 1 from evaluation ev
      join classe c on c.id = ev."classeId"
      where ev.id = note."evaluationId"
        and c."etablissementId" = (select auth_etablissement_id())
    )
  );

drop policy if exists note_ecriture on note;

create policy note_insertion on note for insert with check (
  (select is_super_admin())
  or exists (
    select 1 from evaluation ev
    join classe c on c.id = ev."classeId"
    where ev.id = note."evaluationId"
      and c."etablissementId" = (select auth_etablissement_id())
      and ((select auth_role()) = any (array['DIRECTEUR', 'SECRETAIRE'])
           or ((select auth_role()) = 'ENSEIGNANT'
               and est_affecte(ev."classeId", ev."matiereId", ev."anneeScolaireId")))
  )
);
create policy note_modification on note for update
  using (
    (select is_super_admin())
    or exists (
      select 1 from evaluation ev
      join classe c on c.id = ev."classeId"
      where ev.id = note."evaluationId"
        and c."etablissementId" = (select auth_etablissement_id())
        and ((select auth_role()) = any (array['DIRECTEUR', 'SECRETAIRE'])
             or ((select auth_role()) = 'ENSEIGNANT'
                 and est_affecte(ev."classeId", ev."matiereId", ev."anneeScolaireId")))
    )
  )
  with check (
    (select is_super_admin())
    or exists (
      select 1 from evaluation ev
      join classe c on c.id = ev."classeId"
      where ev.id = note."evaluationId"
        and c."etablissementId" = (select auth_etablissement_id())
        and ((select auth_role()) = any (array['DIRECTEUR', 'SECRETAIRE'])
             or ((select auth_role()) = 'ENSEIGNANT'
                 and est_affecte(ev."classeId", ev."matiereId", ev."anneeScolaireId")))
    )
  );
create policy note_suppression on note for delete using (
  (select is_super_admin())
  or exists (
    select 1 from evaluation ev
    join classe c on c.id = ev."classeId"
    where ev.id = note."evaluationId"
      and c."etablissementId" = (select auth_etablissement_id())
      and ((select auth_role()) = any (array['DIRECTEUR', 'SECRETAIRE'])
           or ((select auth_role()) = 'ENSEIGNANT'
               and est_affecte(ev."classeId", ev."matiereId", ev."anneeScolaireId")))
  )
);

-- utilisateur ---------------------------------------------------------
alter policy utilisateur_lecture on utilisateur
  using ((select is_super_admin()) or "etablissementId" = (select auth_etablissement_id()));

drop policy if exists utilisateur_ecriture on utilisateur;

create policy utilisateur_insertion on utilisateur for insert with check (
  (select is_super_admin())
  or ("etablissementId" = (select auth_etablissement_id())
      and ((select auth_role()) = 'DIRECTEUR' or id = (select auth.uid())))
);
create policy utilisateur_modification on utilisateur for update
  using (
    (select is_super_admin())
    or ("etablissementId" = (select auth_etablissement_id())
        and ((select auth_role()) = 'DIRECTEUR' or id = (select auth.uid())))
  )
  with check (
    (select is_super_admin())
    or ("etablissementId" = (select auth_etablissement_id())
        and ((select auth_role()) = 'DIRECTEUR' or id = (select auth.uid())))
  );
create policy utilisateur_suppression on utilisateur for delete using (
  (select is_super_admin())
  or ("etablissementId" = (select auth_etablissement_id())
      and ((select auth_role()) = 'DIRECTEUR' or id = (select auth.uid())))
);

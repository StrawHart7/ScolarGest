-- Cohérence du passage de cohorte et de l'inscription.
--
-- Trois incohérences constatées en les provoquant sur une base jetable, le
-- 2026-09-01. Aucune n'est atteignable par l'interface — elle ne propose que
-- les classes de l'année cible, et une année cible différente de la source —
-- mais rien ne les empêchait côté base, et c'est la base qui doit trancher :
-- c'est le seul endroit que tous les chemins traversent (écran, import à
-- venir, appel forgé, script de reprise).
--
--   1. Une classe d'une AUTRE année scolaire était acceptée comme cible.
--      L'inscription pointait alors sur la classe de l'an dernier, et la
--      facture sortait à **0 F** : la recherche de tarif joint sur
--      (anneeScolaireId, classeId) et ne trouvait rien. Aucune erreur. C'est
--      la plus vicieuse des trois — elle ne casse rien, elle crée des élèves
--      qui ne doivent rien, et cela se découvre au recouvrement.
--
--   2. Un `inscriptionSourceId` inexistant inscrivait quand même l'élève :
--      l'UPDATE n'affectait aucune ligne, personne ne le vérifiait, et la
--      suite s'exécutait.
--
--   3. `eleveId` et `inscriptionSourceId` n'étaient jamais rapprochés. Rien
--      n'empêchait de clôturer l'année de l'élève B en inscrivant l'élève A.
--
-- Le comportement nominal ne change pas : vérifié avant/après sur le même
-- scénario (facture reprenant le tarif de la classe cible, réexécution
-- idempotente, DEPART sans nouvelle inscription).

-- ============================================================
-- fn_inscrire_eleve — la classe doit appartenir à l'année et au tenant
-- ============================================================
-- Garde ajoutée ici plutôt que dans `fn_passer_cohorte` seule : l'inscription
-- individuelle (`creerInscriptionAvecFacture`) emprunte le même chemin et
-- méritait la même protection.
create or replace function fn_inscrire_eleve(
  p_etablissement_id uuid,
  p_eleve_id uuid,
  p_annee_scolaire_id uuid,
  p_classe_id uuid
) returns jsonb
language plpgsql
security invoker
as $$
declare
  v_inscription_id uuid;
  v_facture_id uuid;
  v_montant_total numeric(12,2) := 0;
  v_tarif record;
  v_classe record;
begin
  -- La classe cible doit exister, appartenir à cet établissement ET à cette
  -- année scolaire. Sans ce contrôle, une classe d'une autre année produisait
  -- une inscription incohérente et une facture à zéro, en silence.
  select c.id, c.nom, c."anneeScolaireId", c."etablissementId"
    into v_classe
    from classe c
   where c.id = p_classe_id;

  if not found then
    raise exception 'Classe cible introuvable.' using errcode = 'P0001';
  end if;

  if v_classe."etablissementId" <> p_etablissement_id then
    raise exception 'Cette classe appartient à un autre établissement.' using errcode = 'P0001';
  end if;

  if v_classe."anneeScolaireId" <> p_annee_scolaire_id then
    raise exception
      'La classe % appartient à une autre année scolaire que celle de l''inscription.', v_classe.nom
      using errcode = 'P0001';
  end if;

  if exists (
    select 1 from inscription
    where "eleveId" = p_eleve_id and "anneeScolaireId" = p_annee_scolaire_id
  ) then
    raise exception 'Cet élève est déjà inscrit pour cette année scolaire.' using errcode = 'P0001';
  end if;

  insert into inscription ("etablissementId", "eleveId", "anneeScolaireId", "classeId")
  values (p_etablissement_id, p_eleve_id, p_annee_scolaire_id, p_classe_id)
  returning id into v_inscription_id;

  insert into facture_eleve ("etablissementId", "eleveId", "anneeScolaireId", "montantTotal")
  values (p_etablissement_id, p_eleve_id, p_annee_scolaire_id, 0)
  returning id into v_facture_id;

  for v_tarif in
    select ts.id, ts.montant, tf.id as "typeFraisId", tf.nom
    from tarif_scolaire ts
    join type_frais tf on tf.id = ts."typeFraisId"
    where ts."anneeScolaireId" = p_annee_scolaire_id and ts."classeId" = p_classe_id
  loop
    insert into ligne_facture ("factureId", "typeFraisId", designation, montant)
    values (v_facture_id, v_tarif."typeFraisId", v_tarif.nom, v_tarif.montant);
    v_montant_total := v_montant_total + v_tarif.montant;
  end loop;

  update facture_eleve set "montantTotal" = v_montant_total where id = v_facture_id;

  return jsonb_build_object('inscriptionId', v_inscription_id, 'factureId', v_facture_id);
end;
$$;

-- ============================================================
-- fn_passer_cohorte — la source doit exister et désigner le bon élève
-- ============================================================
-- Le contrat de retour ne change pas : un jsonb array de
-- {eleveId, ok, message, inscriptionCibleId?, factureCibleId?}. Les nouvelles
-- gardes lèvent, et le gestionnaire d'exception par ligne les transforme en
-- {ok: false, message} — un élève refusé n'arrête toujours pas les suivants.
create or replace function fn_passer_cohorte(
  p_etablissement_id uuid,
  p_annee_cible_id uuid,
  p_decisions jsonb
) returns jsonb
language plpgsql
security invoker
as $$
declare
  v_item jsonb;
  v_eleve_id uuid;
  v_inscription_source_id uuid;
  v_decision text;
  v_classe_cible_id uuid;
  v_result jsonb := '[]'::jsonb;
  v_inscr_res jsonb;
  v_source record;
begin
  for v_item in select * from jsonb_array_elements(p_decisions)
  loop
    begin
      v_eleve_id := (v_item->>'eleveId')::uuid;
      v_inscription_source_id := (v_item->>'inscriptionSourceId')::uuid;
      v_decision := v_item->>'decision';
      v_classe_cible_id := nullif(v_item->>'classeCibleId', '')::uuid;

      -- L'inscription source doit exister, appartenir a ce tenant, et
      -- concerner l'eleve annonce. Auparavant l'UPDATE pouvait n'affecter
      -- aucune ligne sans que personne ne s'en apercoive, et la suite
      -- inscrivait quand meme.
      select i.id, i."eleveId", i."anneeScolaireId"
        into v_source
        from inscription i
       where i.id = v_inscription_source_id
         and i."etablissementId" = p_etablissement_id;

      if not found then
        raise exception 'Inscription de départ introuvable.' using errcode = 'P0001';
      end if;

      if v_source."eleveId" <> v_eleve_id then
        raise exception 'L''inscription de départ concerne un autre élève.' using errcode = 'P0001';
      end if;

      -- Passer une cohorte vers son année de départ n'a pas de sens, et
      -- clôturerait l'inscription que l'on vient de vouloir prolonger.
      if v_source."anneeScolaireId" = p_annee_cible_id then
        raise exception 'L''année cible est la même que l''année de départ.' using errcode = 'P0001';
      end if;

      update inscription
      set statut = 'TERMINEE', "decisionFinAnnee" = v_decision::decision_fin_annee
      where id = v_inscription_source_id and "etablissementId" = p_etablissement_id;

      if v_decision in ('ADMIS', 'REDOUBLANT') then
        if v_classe_cible_id is null then
          raise exception 'Classe cible requise pour ADMIS/REDOUBLANT';
        end if;

        if exists (
          select 1 from inscription
          where "eleveId" = v_eleve_id and "anneeScolaireId" = p_annee_cible_id
        ) then
          -- Ré-exécution idempotente : déjà traité, pas de doublon.
          v_result := v_result || jsonb_build_object(
            'eleveId', v_eleve_id, 'ok', true,
            'message', 'Déjà inscrit dans l''année cible (ignoré)'
          );
        else
          -- `fn_inscrire_eleve` verifie desormais que la classe cible
          -- appartient bien a l'annee cible et a l'etablissement.
          v_inscr_res := fn_inscrire_eleve(p_etablissement_id, v_eleve_id, p_annee_cible_id, v_classe_cible_id);
          v_result := v_result || jsonb_build_object(
            'eleveId', v_eleve_id, 'ok', true, 'message', 'OK',
            'inscriptionCibleId', v_inscr_res->>'inscriptionId',
            'factureCibleId', v_inscr_res->>'factureId'
          );
        end if;
      else
        -- DEPART : pas de nouvelle inscription, statut élève inchangé (décision produit).
        v_result := v_result || jsonb_build_object('eleveId', v_eleve_id, 'ok', true, 'message', 'Départ enregistré');
      end if;
    exception when others then
      v_result := v_result || jsonb_build_object('eleveId', v_eleve_id, 'ok', false, 'message', sqlerrm);
    end;
  end loop;

  return v_result;
end;
$$;

-- Phase 2 — fonctions RPC transactionnelles pour élèves, responsables,
-- inscriptions et facturation automatique.
-- Idempotent: `create or replace function` uniquement, pas de DDL de table.

-- ============================================================
-- fn_creer_eleve_avec_responsables
-- ============================================================
-- Insère un élève et, pour chaque responsable fourni, le crée (ou le relie
-- s'il existe déjà via responsable_id) puis lie eleve_responsable. Si un des
-- responsables fournis a principal=true, force tous les autres liens du même
-- élève à false dans la même transaction (garantit un seul principal=true).
-- RLS-scoped (pas de security definer) : l'appelant doit avoir un JWT avec
-- etablissement_id correspondant, la fonction s'exécute avec ses droits RLS.
create or replace function fn_creer_eleve_avec_responsables(
  p_etablissement_id uuid,
  p_eleve jsonb,
  p_responsables jsonb
) returns uuid
language plpgsql
security invoker
as $$
declare
  v_eleve_id uuid;
  v_responsable jsonb;
  v_responsable_id uuid;
  v_has_principal boolean := false;
begin
  insert into eleve (
    "etablissementId", matricule, "ancienMatricule", nom, prenoms, sexe,
    "dateNaissance", "lieuNaissance", nationalite
  ) values (
    p_etablissement_id,
    p_eleve->>'matricule',
    p_eleve->>'ancienMatricule',
    p_eleve->>'nom',
    p_eleve->>'prenoms',
    (p_eleve->>'sexe')::sexe,
    (p_eleve->>'dateNaissance')::timestamptz,
    p_eleve->>'lieuNaissance',
    p_eleve->>'nationalite'
  ) returning id into v_eleve_id;

  for v_responsable in select * from jsonb_array_elements(p_responsables)
  loop
    if (v_responsable->>'responsableId') is not null then
      v_responsable_id := (v_responsable->>'responsableId')::uuid;
    else
      insert into responsable (
        "etablissementId", nom, prenoms, telephone, email, adresse, profession, type
      ) values (
        p_etablissement_id,
        v_responsable->>'nom',
        v_responsable->>'prenoms',
        v_responsable->>'telephone',
        v_responsable->>'email',
        v_responsable->>'adresse',
        v_responsable->>'profession',
        (v_responsable->>'type')::type_responsable
      ) returning id into v_responsable_id;
    end if;

    insert into eleve_responsable ("eleveId", "responsableId", "lienParente", principal)
    values (
      v_eleve_id,
      v_responsable_id,
      v_responsable->>'lienParente',
      coalesce((v_responsable->>'principal')::boolean, false)
    );

    if coalesce((v_responsable->>'principal')::boolean, false) then
      v_has_principal := true;
    end if;
  end loop;

  if v_has_principal then
    -- Garde exactement une ligne principal=true (la première insérée parmi
    -- celles soumises à true) ; repasse toutes les autres à false, y compris
    -- si plusieurs responsables avaient été soumis avec principal=true.
    update eleve_responsable
    set principal = false
    where "eleveId" = v_eleve_id
      and principal = true
      and id <> (
        select id from eleve_responsable
        where "eleveId" = v_eleve_id and principal = true
        order by id
        limit 1
      );
  end if;

  return v_eleve_id;
end;
$$;

-- ============================================================
-- fn_lier_responsable_eleve
-- ============================================================
-- Ajoute un responsable (nouveau ou existant) à un élève existant, hors
-- création initiale. Même garantie "un seul principal=true" que ci-dessus.
create or replace function fn_lier_responsable_eleve(
  p_etablissement_id uuid,
  p_eleve_id uuid,
  p_responsable jsonb
) returns uuid
language plpgsql
security invoker
as $$
declare
  v_responsable_id uuid;
begin
  if (p_responsable->>'responsableId') is not null then
    v_responsable_id := (p_responsable->>'responsableId')::uuid;
  else
    insert into responsable (
      "etablissementId", nom, prenoms, telephone, email, adresse, profession, type
    ) values (
      p_etablissement_id,
      p_responsable->>'nom',
      p_responsable->>'prenoms',
      p_responsable->>'telephone',
      p_responsable->>'email',
      p_responsable->>'adresse',
      p_responsable->>'profession',
      (p_responsable->>'type')::type_responsable
    ) returning id into v_responsable_id;
  end if;

  insert into eleve_responsable ("eleveId", "responsableId", "lienParente", principal)
  values (
    p_eleve_id,
    v_responsable_id,
    p_responsable->>'lienParente',
    coalesce((p_responsable->>'principal')::boolean, false)
  )
  on conflict ("eleveId", "responsableId")
  do update set "lienParente" = excluded."lienParente", principal = excluded.principal;

  if coalesce((p_responsable->>'principal')::boolean, false) then
    update eleve_responsable
    set principal = false
    where "eleveId" = p_eleve_id and "responsableId" <> v_responsable_id;
  end if;

  return v_responsable_id;
end;
$$;

-- ============================================================
-- fn_inscrire_eleve
-- ============================================================
-- Insère une inscription + génère la facture (squelette à 0 si aucun tarif
-- pour (anneeScolaireId, classeId)). Retourne {inscriptionId, factureId}.
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
begin
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
-- fn_passer_cohorte
-- ============================================================
-- Traite une liste de décisions de fin d'année (une ligne par élève), en
-- boucle avec rapport (pas de rollback global) : un élève en échec n'empêche
-- pas le traitement des suivants. p_decisions: jsonb array de
-- {eleveId, inscriptionSourceId, decision, classeCibleId?}.
-- Retourne un jsonb array de {eleveId, ok, message, inscriptionCibleId?, factureCibleId?}.
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
begin
  for v_item in select * from jsonb_array_elements(p_decisions)
  loop
    begin
      v_eleve_id := (v_item->>'eleveId')::uuid;
      v_inscription_source_id := (v_item->>'inscriptionSourceId')::uuid;
      v_decision := v_item->>'decision';
      v_classe_cible_id := nullif(v_item->>'classeCibleId', '')::uuid;

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

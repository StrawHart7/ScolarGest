-- Phase 6 — fonctions RPC transactionnelles pour la finance école.
-- Idempotent: `create or replace function` uniquement, pas de DDL de table.
--
-- Toutes en `security invoker` (cohérent avec 0004/0006) : elles s'exécutent
-- avec les droits RLS de l'appelant, le service layer a déjà vérifié le rôle.
--
-- Pourquoi des RPC plutôt que plusieurs appels applicatifs : enregistrer un
-- paiement, recalculer le solde et repositionner le statut de la facture
-- doivent être atomiques. Un enchaînement de requêtes REST laisserait une
-- fenêtre où la facture est incohérente avec ses paiements (ou pire, un
-- paiement inséré sans mise à jour du statut si le process meurt entre deux).

-- ============================================================
-- fn_recalculer_statut_facture
-- ============================================================
-- Repositionne le statut d'une facture à partir de la somme de ses paiements
-- non annulés. Ne touche jamais une facture ANNULE (une facture annulée le
-- reste : la corriger consiste à en créer une nouvelle).
-- Retourne {montantTotal, totalPaye, solde, statut}.
create or replace function fn_recalculer_statut_facture(
  p_facture_id uuid
) returns jsonb
language plpgsql
security invoker
as $$
declare
  v_total numeric(12,2);
  v_paye numeric(12,2);
  v_statut statut_facture;
  v_actuel statut_facture;
begin
  select "montantTotal", statut into v_total, v_actuel
  from facture_eleve where id = p_facture_id;

  if v_total is null then
    raise exception 'Facture introuvable.' using errcode = 'P0001';
  end if;

  select coalesce(sum(montant), 0) into v_paye
  from paiement
  where "factureId" = p_facture_id and statut <> 'ANNULE';

  if v_actuel = 'ANNULE' then
    v_statut := 'ANNULE';
  elsif v_paye <= 0 then
    v_statut := 'IMPAYE';
  elsif v_paye >= v_total then
    v_statut := 'PAYE';
  else
    v_statut := 'PARTIEL';
  end if;

  update facture_eleve set statut = v_statut where id = p_facture_id;

  return jsonb_build_object(
    'montantTotal', v_total,
    'totalPaye', v_paye,
    'solde', greatest(v_total - v_paye, 0),
    'statut', v_statut
  );
end;
$$;

-- ============================================================
-- fn_enregistrer_paiement
-- ============================================================
-- Enregistre un versement sur une facture et repositionne son statut dans la
-- même transaction. Le dépassement du solde est refusé : un encaissement
-- supérieur au reste dû est presque toujours une faute de frappe, et il n'y a
-- pas de notion d'avoir ni de remboursement au MVP.
-- Retourne {paiementId, montantTotal, totalPaye, solde, statut}.
create or replace function fn_enregistrer_paiement(
  p_facture_id uuid,
  p_montant numeric,
  p_mode_paiement mode_paiement,
  p_reference text,
  p_date_paiement timestamptz
) returns jsonb
language plpgsql
security invoker
as $$
declare
  v_paiement_id uuid;
  v_total numeric(12,2);
  v_paye numeric(12,2);
  v_statut statut_facture;
  v_recalc jsonb;
begin
  if p_montant is null or p_montant <= 0 then
    raise exception 'Le montant du versement doit être strictement positif.' using errcode = 'P0001';
  end if;

  select "montantTotal", statut into v_total, v_statut
  from facture_eleve where id = p_facture_id
  for update;

  if v_total is null then
    raise exception 'Facture introuvable.' using errcode = 'P0001';
  end if;

  if v_statut = 'ANNULE' then
    raise exception 'Cette facture est annulée : aucun versement ne peut y être enregistré.' using errcode = 'P0001';
  end if;

  select coalesce(sum(montant), 0) into v_paye
  from paiement
  where "factureId" = p_facture_id and statut <> 'ANNULE';

  if v_paye + p_montant > v_total then
    raise exception 'Montant supérieur au solde restant (% FCFA).', v_total - v_paye
      using errcode = 'P0001';
  end if;

  insert into paiement ("factureId", montant, "datePaiement", "modePaiement", reference, statut)
  values (
    p_facture_id,
    p_montant,
    coalesce(p_date_paiement, now()),
    p_mode_paiement,
    nullif(trim(coalesce(p_reference, '')), ''),
    'PAYE'
  )
  returning id into v_paiement_id;

  v_recalc := fn_recalculer_statut_facture(p_facture_id);

  return v_recalc || jsonb_build_object('paiementId', v_paiement_id);
end;
$$;

-- ============================================================
-- fn_annuler_paiement
-- ============================================================
-- Annule un versement : statut ANNULE (jamais de suppression, cf. doc 08 §14)
-- puis recalcul du statut de la facture. La correction se fait en
-- enregistrant un nouveau paiement avec les bonnes informations.
create or replace function fn_annuler_paiement(
  p_paiement_id uuid
) returns jsonb
language plpgsql
security invoker
as $$
declare
  v_facture_id uuid;
  v_statut statut_paiement;
begin
  select "factureId", statut into v_facture_id, v_statut
  from paiement where id = p_paiement_id
  for update;

  if v_facture_id is null then
    raise exception 'Paiement introuvable.' using errcode = 'P0001';
  end if;

  if v_statut = 'ANNULE' then
    raise exception 'Ce versement est déjà annulé.' using errcode = 'P0001';
  end if;

  update paiement set statut = 'ANNULE' where id = p_paiement_id;

  return fn_recalculer_statut_facture(v_facture_id) || jsonb_build_object('factureId', v_facture_id);
end;
$$;

-- ============================================================
-- fn_modifier_lignes_facture
-- ============================================================
-- Remplace l'intégralité des lignes d'une facture et recalcule son montant
-- total puis son statut, en une transaction.
--
-- Verrou métier : les lignes ne sont ajustables que tant qu'aucun versement
-- n'a été encaissé. Le doc 08 §8 parle d'ajustements « avant validation de la
-- facture », mais le schéma (0001_init.sql) n'a pas d'état BROUILLON/VALIDE
-- sur `facture_eleve` — plutôt que d'ajouter un état, on prend le premier
-- encaissement comme point de non-retour : c'est le moment où la facture
-- devient un engagement financier constaté, et cela évite qu'un total change
-- sous des reçus déjà remis aux familles.
--
-- p_lignes : jsonb array de {typeFraisId, designation, montant}.
create or replace function fn_modifier_lignes_facture(
  p_facture_id uuid,
  p_lignes jsonb
) returns jsonb
language plpgsql
security invoker
as $$
declare
  v_statut statut_facture;
  v_nb_paiements int;
  v_ligne jsonb;
  v_total numeric(12,2) := 0;
  v_montant numeric(12,2);
begin
  select statut into v_statut from facture_eleve where id = p_facture_id for update;
  if v_statut is null then
    raise exception 'Facture introuvable.' using errcode = 'P0001';
  end if;
  if v_statut = 'ANNULE' then
    raise exception 'Cette facture est annulée : ses lignes ne sont plus modifiables.' using errcode = 'P0001';
  end if;

  select count(*) into v_nb_paiements
  from paiement where "factureId" = p_facture_id and statut <> 'ANNULE';

  if v_nb_paiements > 0 then
    raise exception 'Un versement a déjà été encaissé : les lignes de cette facture ne sont plus modifiables.'
      using errcode = 'P0001';
  end if;

  delete from ligne_facture where "factureId" = p_facture_id;

  for v_ligne in select * from jsonb_array_elements(p_lignes)
  loop
    v_montant := (v_ligne->>'montant')::numeric;
    if v_montant is null or v_montant < 0 then
      raise exception 'Montant de ligne invalide.' using errcode = 'P0001';
    end if;

    insert into ligne_facture ("factureId", "typeFraisId", designation, montant)
    values (
      p_facture_id,
      (v_ligne->>'typeFraisId')::uuid,
      v_ligne->>'designation',
      v_montant
    );
    v_total := v_total + v_montant;
  end loop;

  update facture_eleve set "montantTotal" = v_total where id = p_facture_id;

  return fn_recalculer_statut_facture(p_facture_id);
end;
$$;

-- ============================================================
-- fn_annuler_facture
-- ============================================================
-- Passe une facture à ANNULE. Jamais de suppression. Refusé si des versements
-- non annulés y sont rattachés : il faut d'abord les annuler explicitement,
-- pour qu'aucun encaissement ne se retrouve orphelin d'une facture active.
create or replace function fn_annuler_facture(
  p_facture_id uuid
) returns jsonb
language plpgsql
security invoker
as $$
declare
  v_statut statut_facture;
  v_nb int;
begin
  select statut into v_statut from facture_eleve where id = p_facture_id for update;
  if v_statut is null then
    raise exception 'Facture introuvable.' using errcode = 'P0001';
  end if;
  if v_statut = 'ANNULE' then
    raise exception 'Cette facture est déjà annulée.' using errcode = 'P0001';
  end if;

  select count(*) into v_nb
  from paiement where "factureId" = p_facture_id and statut <> 'ANNULE';
  if v_nb > 0 then
    raise exception 'Annulez d''abord les % versement(s) encaissé(s) sur cette facture.', v_nb
      using errcode = 'P0001';
  end if;

  update facture_eleve set statut = 'ANNULE' where id = p_facture_id;

  return jsonb_build_object('factureId', p_facture_id, 'statut', 'ANNULE');
end;
$$;

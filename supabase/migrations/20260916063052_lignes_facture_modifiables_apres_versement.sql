-- Les lignes d'une facture restent modifiables apres un versement
--
-- Decision produit du 2026-09-16, prise par l'utilisateur devant le cas reel :
-- « il faut faire sauter cette regle, on peut ajouter a tout moment ».
--
-- `fn_modifier_lignes_facture` refusait toute modification des qu'un versement
-- non annule existait. La regle partait d'une intention comptable saine — une
-- facture sur laquelle de l'argent est arrive ne se reecrit pas a la legere —
-- mais elle ne correspond pas a la vie d'une ecole togolaise :
--
-- - une famille inscrit son enfant a la cantine en janvier, apres avoir regle
--   les frais d'inscription en septembre ;
-- - le transport scolaire se decide au deuxieme trimestre ;
-- - une remise est accordee apres coup sur un frere ou une soeur.
--
-- Le seul recours offert etait « un nouveau versement ou une annulation ».
-- Annuler pour ajouter une ligne de cantine est disproportionne : cela detruit
-- la facture que la famille a recue et deplace ses versements.
--
-- Ce qui NE saute PAS
-- -------------------
-- **Une facture annulee reste intouchable.** Elle a cesse d'exister pour
-- l'ecole ; la rouvrir par ses lignes contournerait l'annulation.
--
-- **Le statut ne se calcule toujours pas ici.** `fn_recalculer_statut_facture`
-- garde le dernier mot, comme pour `fn_enregistrer_paiement` et
-- `fn_changer_classe_inscription`. Trois fonctions ecrivant la meme regle
-- finiraient par diverger.
--
-- **Le verrou reste pose.** `for update` sur la facture : deux secretaires qui
-- reecrivent les lignes en meme temps doivent se serialiser, sans quoi la
-- derniere ecraserait la premiere avec un total calcule sur un etat perime.
--
-- Le trop-percu est rendu, pas tu
-- -------------------------------
-- Baisser le total sous ce qui a deja ete verse **n'est pas refuse** : une
-- ecole qui a facture 325 000 par erreur pour 100 000 reels doit pouvoir
-- corriger, et le remboursement est sa decision, pas celle de la plateforme.
-- Mais l'ecart est **renvoye** (`surplus`) pour que l'ecran le dise. Meme
-- doctrine que `fn_changer_classe_inscription` : un trop-percu silencieux se
-- decouvre le jour ou l'on reclame de l'argent a quelqu'un qui n'en doit pas.
--
-- `solde` reste borne a zero par `fn_recalculer_statut_facture` — c'est
-- `surplus` qui porte l'autre moitie de l'information, et les deux ne peuvent
-- pas etre non nuls en meme temps.
--
-- Aucun changement de schema : seul le corps de la fonction bouge.

create or replace function fn_modifier_lignes_facture(p_facture_id uuid, p_lignes jsonb)
returns jsonb
language plpgsql
set search_path to 'public', 'pg_catalog'
as $$
declare
  v_statut statut_facture;
  v_ligne jsonb;
  v_total numeric(12,2) := 0;
  v_montant numeric(12,2);
  v_paye numeric(12,2);
  v_resultat jsonb;
begin
  select statut into v_statut from facture_eleve where id = p_facture_id for update;
  if v_statut is null then
    raise exception 'Facture introuvable.' using errcode = 'P0001';
  end if;
  if v_statut = 'ANNULE' then
    raise exception 'Cette facture est annulée : ses lignes ne sont plus modifiables.'
      using errcode = 'P0001';
  end if;

  -- Le comptage des versements a disparu : c'est tout l'objet de la migration.

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

  v_resultat := fn_recalculer_statut_facture(p_facture_id);

  -- Les versements annules ne comptent pas, ici comme partout ailleurs.
  select coalesce(sum(montant), 0) into v_paye
  from paiement
  where "factureId" = p_facture_id and statut <> 'ANNULE';

  return v_resultat || jsonb_build_object('surplus', greatest(v_paye - v_total, 0));
end;
$$;

comment on function fn_modifier_lignes_facture(uuid, jsonb) is
  'Remplace les lignes d''une facture et recalcule son total puis son statut. '
  'Modifiable a tout moment tant que la facture n''est pas annulee, versements '
  'encaisses compris (decision du 2026-09-16). Renvoie le surplus quand le '
  'nouveau total passe sous ce qui a deja ete verse.';

-- Phase 3 — fonction RPC transactionnelle pour l'import Excel enseignants.
-- Idempotent: `create or replace function` uniquement, pas de DDL de table.

-- ============================================================
-- fn_creer_enseignant_avec_affectations
-- ============================================================
-- Insère un enseignant (compte Supabase Auth déjà provisionné en amont via
-- inviteUtilisateur, l'Admin API n'étant pas transactionnable avec Postgres)
-- puis, dans la même transaction, toutes les affectations fournies pour ce
-- même enseignant. Garantit qu'un enseignant importé n'est jamais créé "orphelin"
-- (zéro affectation) : si la moindre affectation échoue (ex: doublon), toute
-- la transaction est annulée, y compris l'insertion de l'enseignant.
-- RLS-scoped (pas de security definer) : l'appelant doit avoir un JWT avec
-- etablissement_id correspondant, la fonction s'exécute avec ses droits RLS.
create or replace function fn_creer_enseignant_avec_affectations(
  p_etablissement_id uuid,
  p_utilisateur_id uuid,
  p_enseignant jsonb,
  p_affectations jsonb
) returns uuid
language plpgsql
security invoker
as $$
declare
  v_enseignant_id uuid;
  v_affectation jsonb;
begin
  if p_affectations is null or jsonb_array_length(p_affectations) = 0 then
    raise exception 'Au moins une affectation est requise pour créer un enseignant.' using errcode = 'P0001';
  end if;

  insert into enseignant (
    "etablissementId", "utilisateurId", matricule, "ancienMatricule", nom, prenoms, sexe,
    "dateNaissance", telephone, email, adresse, "dateEmbauche", statut
  ) values (
    p_etablissement_id,
    p_utilisateur_id,
    p_enseignant->>'matricule',
    nullif(p_enseignant->>'ancienMatricule', ''),
    p_enseignant->>'nom',
    p_enseignant->>'prenoms',
    (p_enseignant->>'sexe')::sexe,
    nullif(p_enseignant->>'dateNaissance', '')::timestamptz,
    nullif(p_enseignant->>'telephone', ''),
    p_enseignant->>'email',
    nullif(p_enseignant->>'adresse', ''),
    nullif(p_enseignant->>'dateEmbauche', '')::timestamptz,
    coalesce(p_enseignant->>'statut', 'ACTIF')::statut_enseignant
  ) returning id into v_enseignant_id;

  for v_affectation in select * from jsonb_array_elements(p_affectations)
  loop
    begin
      insert into affectation_enseignant (
        "etablissementId", "anneeScolaireId", "enseignantId", "classeId", "matiereId"
      ) values (
        p_etablissement_id,
        (v_affectation->>'anneeScolaireId')::uuid,
        v_enseignant_id,
        (v_affectation->>'classeId')::uuid,
        (v_affectation->>'matiereId')::uuid
      );
    exception when unique_violation then
      raise exception 'Affectation en doublon (classe/matière déjà affectée à cet enseignant pour cette année).' using errcode = 'P0001';
    end;
  end loop;

  return v_enseignant_id;
end;
$$;

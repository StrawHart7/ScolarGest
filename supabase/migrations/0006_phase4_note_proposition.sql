-- Phase 4 — workflow de proposition/approbation de modification de note.

alter table note add column if not exists "valeurProposee" float8;
alter table note add column if not exists "demandePar" uuid references utilisateur(id);

-- ============================================================
-- fn_soumettre_notes
-- ============================================================
-- Bascule en masse toutes les notes BROUILLON d'une évaluation vers SOUMISE.
-- security invoker (cohérent avec 0004_phase2_rpc.sql) : s'exécute avec les
-- droits RLS de l'appelant, le service layer (note.ts) a déjà vérifié le
-- périmètre (rôle + affectation enseignant) avant l'appel RPC.
-- Retourne le nombre de notes basculées.
create or replace function fn_soumettre_notes(
  p_evaluation_id uuid
) returns int
language plpgsql
security invoker
as $$
declare
  v_count int;
begin
  update note
  set statut = 'SOUMISE'
  where "evaluationId" = p_evaluation_id
    and statut = 'BROUILLON';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

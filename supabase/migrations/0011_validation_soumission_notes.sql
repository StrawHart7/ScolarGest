-- Corrections fonctionnelles 2026-08 — la soumission d'une note par un
-- enseignant ne la rendait jamais officielle qu'en apparence : SOUMISE était
-- déjà comptée dans les moyennes sans qu'aucune validation n'ait jamais eu
-- lieu, et la Secrétaire n'avait ni signal ni écran pour intervenir dessus.
-- SOUMISE devient un vrai statut d'attente ; VALIDE (nouveau geste de la
-- Secrétaire) est désormais ce qui compte dans les moyennes.

alter table note add column if not exists "motifRejetSoumission" text;

-- Migration de données one-shot : toute note déjà SOUMISE aujourd'hui a été
-- comptée dans des moyennes et des bulletins potentiellement déjà émis. On la
-- traite comme déjà validée plutôt que de la rejeter rétroactivement dans la
-- file de la Secrétaire — seules les soumissions futures suivent le nouveau
-- circuit.
update note set statut = 'VALIDE' where statut = 'SOUMISE';

-- ============================================================
-- fn_valider_soumission
-- ============================================================
-- Valide en bloc toutes les notes SOUMISE d'une évaluation : elles
-- deviennent VALIDE et comptent désormais dans les moyennes. Retourne le
-- nombre de notes basculées.
create or replace function fn_valider_soumission(
  p_evaluation_id uuid
) returns int
language plpgsql
security invoker
as $$
declare
  v_count int;
begin
  update note
  set statut = 'VALIDE',
      "motifRejetSoumission" = null
  where "evaluationId" = p_evaluation_id
    and statut = 'SOUMISE';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ============================================================
-- fn_rejeter_soumission
-- ============================================================
-- Rejette en bloc les notes SOUMISE d'une évaluation : retour en BROUILLON
-- chez l'enseignant, avec le motif conservé jusqu'à la prochaine soumission
-- (fn_soumettre_notes l'efface). Retourne le nombre de notes basculées.
create or replace function fn_rejeter_soumission(
  p_evaluation_id uuid,
  p_motif text
) returns int
language plpgsql
security invoker
as $$
declare
  v_count int;
begin
  update note
  set statut = 'BROUILLON',
      "motifRejetSoumission" = p_motif
  where "evaluationId" = p_evaluation_id
    and statut = 'SOUMISE';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- fn_soumettre_notes (0006) doit effacer un motif de rejet précédent quand
-- l'enseignant corrige et resoumet, sinon le message resterait affiché après
-- correction.
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
  set statut = 'SOUMISE',
      "motifRejetSoumission" = null
  where "evaluationId" = p_evaluation_id
    and statut = 'BROUILLON';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

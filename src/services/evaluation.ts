import { createClient } from '@/lib/supabase/server';
import { requireRole } from './authorization';
import { auditLog } from './audit';
import { getEnseignantParUtilisateur } from './enseignant';

export type TypeEvaluation = 'INTERROGATION' | 'DEVOIR' | 'COMPOSITION';
export type Periode = 'TRIMESTRE_1' | 'TRIMESTRE_2' | 'TRIMESTRE_3';

export interface Evaluation {
  id: string;
  anneeScolaireId: string;
  classeId: string;
  matiereId: string;
  type: TypeEvaluation;
  periode: Periode;
  numero: number;
  date: string;
  createdAt: string;
}

export interface CreerEvaluationInput {
  anneeScolaireId: string;
  classeId: string;
  matiereId: string;
  type: TypeEvaluation;
  periode: Periode;
  numero: number;
  date: string;
}

const EVALUATION_FIELDS =
  'id, "anneeScolaireId", "classeId", "matiereId", type, periode, numero, date, "createdAt"';

/**
 * Vérifie que l'utilisateur ENSEIGNANT connecté est bien affecté à
 * (classeId, matiereId) pour cette année. Directeur/Secrétaire passent
 * toujours (périmètre large). Throw si hors périmètre.
 */
async function verifierPerimetreEnseignant(
  role: string,
  userId: string,
  etablissementId: string,
  classeId: string,
  matiereId: string,
  anneeScolaireId: string,
): Promise<void> {
  if (role !== 'ENSEIGNANT') return;
  const enseignant = await getEnseignantParUtilisateur(userId);
  if (!enseignant) throw new Error('Accès refusé: profil enseignant introuvable');

  const supabase = createClient();
  const { count, error } = await supabase
    .from('affectation_enseignant')
    .select('id', { count: 'exact', head: true })
    .eq('etablissementId', etablissementId)
    .eq('enseignantId', enseignant.id)
    .eq('classeId', classeId)
    .eq('matiereId', matiereId)
    .eq('anneeScolaireId', anneeScolaireId);
  if (error) throw error;
  if ((count ?? 0) === 0) {
    throw new Error('Accès refusé: vous n\'êtes pas affecté à cette classe pour cette matière');
  }
}

export async function listEvaluations(
  classeId: string,
  matiereId: string,
  periode: Periode,
): Promise<Evaluation[]> {
  await requireRole('DIRECTEUR', 'SECRETAIRE', 'ENSEIGNANT');
  const supabase = createClient();
  const { data, error } = await supabase
    .from('evaluation')
    .select(EVALUATION_FIELDS)
    .eq('classeId', classeId)
    .eq('matiereId', matiereId)
    .eq('periode', periode)
    .order('type')
    .order('numero');
  if (error) throw error;
  return (data ?? []) as unknown as Evaluation[];
}

/**
 * Crée une évaluation. Contrainte DB unique (classeId, matiereId, type,
 * periode, numero). Validation applicative: INTERROGATION → numero <= 3
 * (Docs/07 §5, au plus 3 interrogations par matière/période).
 */
export async function creerEvaluation(input: CreerEvaluationInput): Promise<string> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'ENSEIGNANT');

  if (input.type === 'INTERROGATION' && input.numero > 3) {
    throw new Error('Au maximum 3 interrogations par matière et par période.');
  }

  await verifierPerimetreEnseignant(
    ctx.role,
    ctx.userId,
    ctx.etablissementId,
    input.classeId,
    input.matiereId,
    input.anneeScolaireId,
  );

  const supabase = createClient();
  const { data, error } = await supabase
    .from('evaluation')
    .insert({
      anneeScolaireId: input.anneeScolaireId,
      classeId: input.classeId,
      matiereId: input.matiereId,
      type: input.type,
      periode: input.periode,
      numero: input.numero,
      date: input.date,
    })
    .select('id')
    .single();
  if (error) {
    if (error.code === '23505') {
      throw new Error('Une évaluation identique existe déjà (classe, matière, type, période, numéro).');
    }
    throw error;
  }

  await auditLog({
    action: 'CREER_EVALUATION',
    module: 'academique',
    objetType: 'Evaluation',
    objetId: data.id,
    nouvelleValeur: input,
  });

  return data.id as string;
}

/** Supprime une évaluation. Bloqué si des notes non-BROUILLON existent déjà. */
export async function supprimerEvaluation(id: string): Promise<void> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'ENSEIGNANT');
  const supabase = createClient();

  const { data: evaluation, error: evalError } = await supabase
    .from('evaluation')
    .select(EVALUATION_FIELDS)
    .eq('id', id)
    .single();
  if (evalError) throw evalError;

  await verifierPerimetreEnseignant(
    ctx.role,
    ctx.userId,
    ctx.etablissementId,
    evaluation.classeId,
    evaluation.matiereId,
    evaluation.anneeScolaireId,
  );

  const { count, error: countError } = await supabase
    .from('note')
    .select('id', { count: 'exact', head: true })
    .eq('evaluationId', id)
    .neq('statut', 'BROUILLON');
  if (countError) throw countError;
  if ((count ?? 0) > 0) {
    throw new Error('Impossible de supprimer cette évaluation : des notes ont déjà été soumises.');
  }

  const { error } = await supabase.from('evaluation').delete().eq('id', id);
  if (error) throw error;

  await auditLog({
    action: 'SUPPRIMER_EVALUATION',
    module: 'academique',
    objetType: 'Evaluation',
    objetId: id,
  });
}

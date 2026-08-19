import { createClient } from '@/lib/supabase/server';
import { requireRole } from './authorization';
import { getEnseignantParUtilisateur } from './enseignant';
import type { Evaluation } from './evaluation';

/**
 * Lecture d'une évaluation par id, avec le même contrôle de périmètre
 * enseignant que `evaluation.ts` / `note.ts` (fichiers stables du Milestone 0,
 * non modifiés ici). Ce fichier existe séparément car ces deux services
 * n'exposent pas de `getEvaluation` public — nécessaire à l'écran de saisie
 * (Milestone 2) pour résoudre classe/matière/période à partir de l'URL
 * `/notes/saisie/[evaluationId]`.
 */

const EVALUATION_FIELDS =
  'id, "anneeScolaireId", "classeId", "matiereId", type, periode, numero, date, "createdAt"';

export async function getEvaluationDetail(id: string): Promise<Evaluation> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'ENSEIGNANT');
  const supabase = createClient();

  const { data, error } = await supabase
    .from('evaluation')
    .select(EVALUATION_FIELDS)
    .eq('id', id)
    .single();
  if (error) throw error;
  const evaluation = data as unknown as Evaluation;

  if (ctx.role === 'ENSEIGNANT') {
    const enseignant = await getEnseignantParUtilisateur(ctx.userId);
    if (!enseignant) throw new Error('Accès refusé: profil enseignant introuvable');

    const { count, error: affError } = await supabase
      .from('affectation_enseignant')
      .select('id', { count: 'exact', head: true })
      .eq('etablissementId', ctx.etablissementId)
      .eq('enseignantId', enseignant.id)
      .eq('classeId', evaluation.classeId)
      .eq('matiereId', evaluation.matiereId)
      .eq('anneeScolaireId', evaluation.anneeScolaireId);
    if (affError) throw affError;
    if ((count ?? 0) === 0) {
      throw new Error("Accès refusé: vous n'êtes pas affecté à cette classe pour cette matière");
    }
  }

  return evaluation;
}

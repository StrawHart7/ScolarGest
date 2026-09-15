'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { creerEvaluation } from '@/services/evaluation';
import { mInscrireCommeEnseignant } from '@/services/enseignant';

/**
 * Le directeur se déclare enseignant depuis l'écran de saisie.
 *
 * Aucun nouveau compte : la fiche est rattachée au sien. Voir
 * `mInscrireCommeEnseignant` — c'était l'impasse signalée en preview.
 */
export async function mInscrireCommeEnseignantAction(): Promise<
  { enseignantId: string } | { erreur: string }
> {
  try {
    return { enseignantId: await mInscrireCommeEnseignant() };
  } catch (e) {
    return { erreur: e instanceof Error ? e.message : "Erreur lors de l'inscription" };
  }
}

const creerEvaluationSchema = z.object({
  anneeScolaireId: z.string().uuid('Année scolaire requise'),
  classeId: z.string().uuid('Classe requise'),
  matiereId: z.string().uuid('Matière requise'),
  type: z.enum(['INTERROGATION', 'DEVOIR', 'COMPOSITION'], { errorMap: () => ({ message: 'Type requis' }) }),
  periode: z.enum(['TRIMESTRE_1', 'TRIMESTRE_2', 'TRIMESTRE_3'], {
    errorMap: () => ({ message: 'Période requise' }),
  }),
  // Ni `numero` ni plafond de trois interrogations depuis le 2026-09-15 : le
  // service le déduit, et le devoir comme la composition sont uniques par
  // période — par la contrainte de `0001`, pas par une règle applicative.
  date: z.string().min(1, 'Date requise'),
});

/**
 * Crée une évaluation puis redirige vers la grille de saisie. Le contrôle de
 * périmètre enseignant reste au service ; la validation Zod ici ne fait que
 * rendre l'erreur de formulaire plus tôt et plus lisible.
 */
export async function creerEvaluationAction(
  _prevState: string | null,
  formData: FormData,
): Promise<string | null> {
  const parsed = creerEvaluationSchema.safeParse({
    anneeScolaireId: formData.get('anneeScolaireId'),
    classeId: formData.get('classeId'),
    matiereId: formData.get('matiereId'),
    type: formData.get('type'),
    periode: formData.get('periode'),
    date: formData.get('date'),
  });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? 'Il manque une information : vérifiez les champs signalés, puis réessayez.';
  }

  let evaluationId: string;
  try {
    evaluationId = await creerEvaluation(parsed.data);
  } catch (e) {
    return e instanceof Error ? e.message : "Erreur lors de la création de l'évaluation";
  }

  redirect(`/etablissement/notes/saisie/${evaluationId}`);
}

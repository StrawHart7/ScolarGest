'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { creerEvaluation } from '@/services/evaluation';

const creerEvaluationSchema = z
  .object({
    anneeScolaireId: z.string().uuid('Année scolaire requise'),
    classeId: z.string().uuid('Classe requise'),
    matiereId: z.string().uuid('Matière requise'),
    type: z.enum(['INTERROGATION', 'DEVOIR', 'COMPOSITION'], { errorMap: () => ({ message: 'Type requis' }) }),
    periode: z.enum(['TRIMESTRE_1', 'TRIMESTRE_2', 'TRIMESTRE_3'], {
      errorMap: () => ({ message: 'Période requise' }),
    }),
    numero: z.coerce.number().int('Numéro invalide').min(1, 'Numéro invalide'),
    date: z.string().min(1, 'Date requise'),
  })
  .refine((d) => d.type !== 'INTERROGATION' || d.numero <= 3, {
    message: 'Au maximum 3 interrogations par matière et par période.',
    path: ['numero'],
  });

/**
 * Crée une évaluation puis redirige vers la grille de saisie. Le service
 * `creerEvaluation` (Milestone 0, non modifié) applique déjà la même règle
 * INTERROGATION <= 3 et le contrôle de périmètre enseignant — la validation
 * Zod ici ne fait que donner une erreur de formulaire plus tôt/claire.
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
    numero: formData.get('numero'),
    date: formData.get('date'),
  });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? 'Formulaire invalide';
  }

  let evaluationId: string;
  try {
    evaluationId = await creerEvaluation(parsed.data);
  } catch (e) {
    return e instanceof Error ? e.message : "Erreur lors de la création de l'évaluation";
  }

  redirect(`/etablissement/notes/saisie/${evaluationId}`);
}

'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { saisirNote, soumettreNotes } from '@/services/note';

const saisirNoteSchema = z.object({
  evaluationId: z.string().uuid(),
  eleveId: z.string().uuid(),
  valeur: z.coerce.number().min(0, 'La note doit être comprise entre 0 et 20.').max(20, 'La note doit être comprise entre 0 et 20.'),
  observation: z.string().optional(),
});

export interface SaisirNoteInput {
  evaluationId: string;
  eleveId: string;
  valeur: number;
  observation?: string;
}

/** Upsert d'une ligne (élève, note) — appelé une fois par ligne modifiée depuis la grille client. */
export async function saisirNoteAction(input: SaisirNoteInput): Promise<string | null> {
  const parsed = saisirNoteSchema.safeParse(input);
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? 'Donnée invalide';
  }

  try {
    await saisirNote(parsed.data.evaluationId, parsed.data.eleveId, parsed.data.valeur, parsed.data.observation);
  } catch (e) {
    return e instanceof Error ? e.message : 'Erreur lors de la saisie de la note';
  }

  revalidatePath(`/etablissement/notes/saisie/${parsed.data.evaluationId}`);
  return null;
}

const evaluationIdSchema = z.string().uuid();

/** Bascule toutes les notes BROUILLON de l'évaluation en SOUMISE (verrouillage). */
export async function soumettreNotesAction(evaluationId: string): Promise<string | null> {
  const parsed = evaluationIdSchema.safeParse(evaluationId);
  if (!parsed.success) return 'Identifiant invalide';

  try {
    await soumettreNotes(parsed.data);
  } catch (e) {
    return e instanceof Error ? e.message : 'Erreur lors de la soumission des notes';
  }

  revalidatePath(`/etablissement/notes/saisie/${parsed.data}`);
  return null;
}

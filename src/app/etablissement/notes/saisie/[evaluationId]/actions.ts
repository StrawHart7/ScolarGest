'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { saisirNote, soumettreNotes, demanderModification } from '@/services/note';
import { executerUneSeuleFois } from '@/services/synchronisation';
import { messageErreur } from '@/lib/offline/operations';

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
    return messageErreur(e);
  }

  revalidatePath(`/etablissement/notes/saisie/${parsed.data.evaluationId}`);
  return null;
}

const evaluationIdSchema = z.string().uuid();

/** Bascule toutes les notes BROUILLON de l'évaluation en SOUMISE (verrouillage). */
export async function soumettreNotesAction(
  evaluationId: string,
  cleOperation?: string,
): Promise<string | null> {
  const parsed = evaluationIdSchema.safeParse(evaluationId);
  if (!parsed.success) return 'Identifiant invalide';

  try {
    // La soumission n'est pas un upsert : elle bascule les notes en SOUMISE et
    // verrouille l'evaluation. La rejouer apres une coupure echouerait sur une
    // evaluation deja verrouillee, et l'utilisateur lirait une erreur pour une
    // action qui avait pourtant abouti. D'ou la cle d'idempotence quand
    // l'appel vient de la file hors ligne.
    if (cleOperation) {
      await executerUneSeuleFois(cleOperation, 'SOUMISSION_NOTES', async () => {
        await soumettreNotes(parsed.data);
        return { evaluationId: parsed.data };
      });
    } else {
      await soumettreNotes(parsed.data);
    }
  } catch (e) {
    return messageErreur(e);
  }

  revalidatePath(`/etablissement/notes/saisie/${parsed.data}`);
  return null;
}

const demanderModificationSchema = z.object({
  noteId: z.string().uuid(),
  evaluationId: z.string().uuid(),
  nouvelleValeur: z.coerce.number().min(0, 'La note doit être comprise entre 0 et 20.').max(20, 'La note doit être comprise entre 0 et 20.'),
  observation: z.string().optional(),
});

/** Demande de correction sur une note déjà VALIDE — passe par l'approbation de la secrétaire (PIN). */
export async function demanderModificationAction(
  input: {
    noteId: string;
    evaluationId: string;
    nouvelleValeur: number;
    observation?: string;
  },
  cleOperation?: string,
): Promise<string | null> {
  const parsed = demanderModificationSchema.safeParse(input);
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? 'Donnée invalide';
  }

  try {
    // Rejouee, une demande de correction en creerait une seconde : la
    // secretaire verrait deux fois la meme ligne dans sa file d'approbation et
    // ne saurait pas laquelle traiter.
    if (cleOperation) {
      await executerUneSeuleFois(cleOperation, 'DEMANDE_CORRECTION', async () => {
        await demanderModification(
          parsed.data.noteId,
          parsed.data.nouvelleValeur,
          parsed.data.observation,
        );
        return { noteId: parsed.data.noteId };
      });
    } else {
      await demanderModification(
        parsed.data.noteId,
        parsed.data.nouvelleValeur,
        parsed.data.observation,
      );
    }
  } catch (e) {
    return messageErreur(e);
  }

  revalidatePath(`/etablissement/notes/saisie/${parsed.data.evaluationId}`);
  return null;
}

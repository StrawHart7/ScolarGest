'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { desactiverEnseignant } from '@/services/enseignant';

const idSchema = z.string().uuid();

export async function desactiverEnseignantAction(enseignantId: string): Promise<string | null> {
  const parsed = idSchema.safeParse(enseignantId);
  if (!parsed.success) return 'Identifiant invalide';
  try {
    await desactiverEnseignant(parsed.data);
  } catch (e) {
    return e instanceof Error ? e.message : "Erreur lors de la désactivation";
  }
  revalidatePath(`/etablissement/enseignants/${enseignantId}`);
  return null;
}

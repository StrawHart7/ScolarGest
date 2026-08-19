'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { archiverEleve } from '@/services/eleve';
import { annulerInscription } from '@/services/inscription';

const idSchema = z.string().uuid();

export async function archiverEleveAction(eleveId: string): Promise<string | null> {
  const parsed = idSchema.safeParse(eleveId);
  if (!parsed.success) return 'Identifiant invalide';
  try {
    await archiverEleve(parsed.data);
  } catch (e) {
    return e instanceof Error ? e.message : "Erreur lors de l'archivage";
  }
  revalidatePath(`/etablissement/eleves/${eleveId}`);
  return null;
}

export async function annulerInscriptionAction(
  eleveId: string,
  inscriptionId: string,
): Promise<string | null> {
  const parsed = idSchema.safeParse(inscriptionId);
  if (!parsed.success) return 'Identifiant invalide';
  try {
    await annulerInscription(parsed.data);
  } catch (e) {
    return e instanceof Error ? e.message : "Erreur lors de l'annulation";
  }
  revalidatePath(`/etablissement/eleves/${eleveId}`);
  return null;
}

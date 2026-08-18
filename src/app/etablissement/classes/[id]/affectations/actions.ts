'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { definirTitulaire, retirerTitulaire } from '@/services/titularite';

const definirTitulaireSchema = z.object({
  classeId: z.string().uuid('Classe requise'),
  anneeScolaireId: z.string().uuid('Année scolaire requise'),
  enseignantId: z.string().uuid('Enseignant requis'),
});

export async function definirTitulaireAction(
  _prevState: string | null,
  formData: FormData,
): Promise<string | null> {
  const parsed = definirTitulaireSchema.safeParse({
    classeId: formData.get('classeId'),
    anneeScolaireId: formData.get('anneeScolaireId'),
    enseignantId: formData.get('enseignantId'),
  });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? 'Formulaire invalide';
  }

  try {
    await definirTitulaire(parsed.data.classeId, parsed.data.anneeScolaireId, parsed.data.enseignantId);
  } catch (e) {
    return e instanceof Error ? e.message : 'Erreur lors de la définition du titulaire';
  }

  revalidatePath(`/etablissement/classes/${parsed.data.classeId}/affectations`);
  return null;
}

const idSchema = z.string().uuid();

export async function retirerTitulaireAction(classeId: string): Promise<string | null> {
  const parsed = idSchema.safeParse(classeId);
  if (!parsed.success) return 'Identifiant invalide';
  try {
    await retirerTitulaire(parsed.data);
  } catch (e) {
    return e instanceof Error ? e.message : 'Erreur lors du retrait du titulaire';
  }
  revalidatePath(`/etablissement/classes/${classeId}/affectations`);
  return null;
}

'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createTypeFrais, updateTypeFrais } from '@/services/type-frais';

const createSchema = z.object({
  nom: z.string().min(1, 'Nom requis'),
  description: z.string().optional(),
});

export async function creerTypeFraisAction(
  _prevState: string | null,
  formData: FormData,
): Promise<string | null> {
  const parsed = createSchema.safeParse({
    nom: formData.get('nom'),
    description: formData.get('description'),
  });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? 'Formulaire invalide';
  }

  try {
    await createTypeFrais({
      nom: parsed.data.nom,
      description: parsed.data.description || undefined,
    });
  } catch (e) {
    return e instanceof Error ? e.message : 'Erreur lors de la création';
  }

  revalidatePath('/etablissement/finances/types-frais');
  return 'OK';
}

const updateSchema = z.object({
  id: z.string().uuid('Type de frais requis'),
  nom: z.string().min(1, 'Nom requis').optional(),
  description: z.string().optional(),
  statut: z.enum(['ACTIF', 'INACTIF']).optional(),
});

export async function modifierTypeFraisAction(
  _prevState: string | null,
  formData: FormData,
): Promise<string | null> {
  const parsed = updateSchema.safeParse({
    id: formData.get('id'),
    nom: formData.get('nom') || undefined,
    description: formData.get('description') ?? undefined,
    statut: formData.get('statut') || undefined,
  });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? 'Formulaire invalide';
  }

  const { id, ...data } = parsed.data;

  try {
    await updateTypeFrais(id, {
      ...(data.nom !== undefined ? { nom: data.nom } : {}),
      ...(data.description !== undefined ? { description: data.description || null } : {}),
      ...(data.statut !== undefined ? { statut: data.statut } : {}),
    });
  } catch (e) {
    return e instanceof Error ? e.message : 'Erreur lors de la modification';
  }

  revalidatePath('/etablissement/finances/types-frais');
  return 'OK';
}

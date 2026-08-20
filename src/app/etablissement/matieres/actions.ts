'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createMatiere, updateMatiere } from '@/services/matiere';

const createSchema = z.object({
  nom: z.string().min(1, 'Nom requis'),
  code: z.string().optional(),
  description: z.string().optional(),
});

export async function creerMatiereAction(
  _prevState: string | null,
  formData: FormData,
): Promise<string | null> {
  const parsed = createSchema.safeParse({
    nom: formData.get('nom'),
    code: formData.get('code'),
    description: formData.get('description'),
  });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? 'Formulaire invalide';
  }

  try {
    await createMatiere({
      nom: parsed.data.nom,
      code: parsed.data.code || undefined,
      description: parsed.data.description || undefined,
    });
  } catch (e) {
    return e instanceof Error ? e.message : 'Erreur lors de la création';
  }

  revalidatePath('/etablissement/matieres');
  return 'OK';
}

const updateSchema = z.object({
  id: z.string().uuid('Matière requise'),
  nom: z.string().min(1, 'Nom requis').optional(),
  code: z.string().optional(),
  description: z.string().optional(),
  statut: z.enum(['ACTIF', 'INACTIF']).optional(),
});

export async function modifierMatiereAction(
  _prevState: string | null,
  formData: FormData,
): Promise<string | null> {
  const parsed = updateSchema.safeParse({
    id: formData.get('id'),
    nom: formData.get('nom') || undefined,
    code: formData.get('code'),
    description: formData.get('description'),
    statut: formData.get('statut') || undefined,
  });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? 'Formulaire invalide';
  }

  const { id, ...data } = parsed.data;

  try {
    await updateMatiere(id, {
      ...(data.nom !== undefined ? { nom: data.nom } : {}),
      ...(data.code !== undefined ? { code: data.code || null } : {}),
      ...(data.description !== undefined ? { description: data.description || null } : {}),
      ...(data.statut !== undefined ? { statut: data.statut } : {}),
    });
  } catch (e) {
    return e instanceof Error ? e.message : 'Erreur lors de la modification';
  }

  revalidatePath('/etablissement/matieres');
  return 'OK';
}

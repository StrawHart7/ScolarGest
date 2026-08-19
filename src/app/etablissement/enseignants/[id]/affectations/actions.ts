'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { creerAffectation, supprimerAffectation } from '@/services/affectation';
import { createMatiere } from '@/services/matiere';

const creerAffectationSchema = z.object({
  anneeScolaireId: z.string().uuid('Année scolaire requise'),
  enseignantId: z.string().uuid('Enseignant requis'),
  classeId: z.string().uuid('Classe requise'),
  matiereId: z.string().uuid('Matière requise'),
});

export async function creerAffectationAction(
  _prevState: string | null,
  formData: FormData,
): Promise<string | null> {
  const parsed = creerAffectationSchema.safeParse({
    anneeScolaireId: formData.get('anneeScolaireId'),
    enseignantId: formData.get('enseignantId'),
    classeId: formData.get('classeId'),
    matiereId: formData.get('matiereId'),
  });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? 'Formulaire invalide';
  }

  try {
    await creerAffectation(parsed.data);
  } catch (e) {
    return e instanceof Error ? e.message : "Erreur lors de la création de l'affectation";
  }

  revalidatePath(`/etablissement/enseignants/${parsed.data.enseignantId}/affectations`);
  return null;
}

const idSchema = z.string().uuid();

export async function supprimerAffectationAction(
  enseignantId: string,
  affectationId: string,
): Promise<string | null> {
  const parsed = idSchema.safeParse(affectationId);
  if (!parsed.success) return 'Identifiant invalide';
  try {
    await supprimerAffectation(parsed.data);
  } catch (e) {
    return e instanceof Error ? e.message : "Erreur lors de la suppression de l'affectation";
  }
  revalidatePath(`/etablissement/enseignants/${enseignantId}/affectations`);
  return null;
}

const creerMatiereSchema = z.object({
  enseignantId: z.string().uuid(),
  nom: z.string().min(1, 'Nom de la matière requis'),
});

export async function creerMatiereAction(
  _prevState: string | null,
  formData: FormData,
): Promise<string | null> {
  const parsed = creerMatiereSchema.safeParse({
    enseignantId: formData.get('enseignantId'),
    nom: formData.get('nom'),
  });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? 'Formulaire invalide';
  }

  try {
    await createMatiere({ nom: parsed.data.nom });
  } catch (e) {
    return e instanceof Error ? e.message : 'Erreur lors de la création de la matière';
  }

  revalidatePath(`/etablissement/enseignants/${parsed.data.enseignantId}/affectations`);
  return null;
}

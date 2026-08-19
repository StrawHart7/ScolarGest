'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createTarif } from '@/services/tarif';

const schema = z.object({
  anneeScolaireId: z.string().uuid('Année scolaire requise'),
  classeId: z.string().uuid('Classe requise'),
  typeFraisId: z.string().uuid('Type de frais requis'),
  montant: z.coerce.number().min(0, 'Montant invalide'),
});

/**
 * Création uniquement : un `TarifScolaire` est immuable (doc 08 §6). Il n'y a
 * volontairement aucune action de modification ni de suppression ici.
 */
export async function creerTarifAction(
  _prevState: string | null,
  formData: FormData,
): Promise<string | null> {
  const parsed = schema.safeParse({
    anneeScolaireId: formData.get('anneeScolaireId'),
    classeId: formData.get('classeId'),
    typeFraisId: formData.get('typeFraisId'),
    montant: formData.get('montant'),
  });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? 'Formulaire invalide';
  }

  try {
    await createTarif(parsed.data);
  } catch (e) {
    return e instanceof Error ? e.message : 'Erreur lors de la création du tarif';
  }

  revalidatePath('/etablissement/finances/tarifs');
  return null;
}

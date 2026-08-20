'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  activerAnneeScolaire,
  cloturerAnneeScolaire,
  createAnneeScolaire,
} from '@/services/annee-scolaire';

const schema = z.object({
  libelle: z.string().min(4, 'Libellé requis (ex: 2026-2027)'),
  dateDebut: z.string().min(1, 'Date de début requise'),
  dateFin: z.string().min(1, 'Date de fin requise'),
});

export async function creerAnneeScolaire(
  _prevState: string | null,
  formData: FormData,
): Promise<string> {
  const parsed = schema.safeParse({
    libelle: formData.get('libelle'),
    dateDebut: formData.get('dateDebut'),
    dateFin: formData.get('dateFin'),
  });

  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? 'Formulaire invalide';
  }
  if (parsed.data.dateFin <= parsed.data.dateDebut) {
    return 'La date de fin doit être postérieure à la date de début.';
  }

  try {
    await createAnneeScolaire(parsed.data);
  } catch (e) {
    return e instanceof Error ? e.message : 'Erreur lors de la création';
  }

  revalidatePath('/etablissement/annees-scolaires');
  return 'OK';
}

/** Renvoie `null` en cas de succès, le message d'erreur sinon. */
export async function activerAnnee(pin: string, donnees: FormData): Promise<string | null> {
  const anneeScolaireId = String(donnees.get('anneeScolaireId') ?? '');
  if (!anneeScolaireId) return 'Année scolaire introuvable.';

  try {
    await activerAnneeScolaire(anneeScolaireId, pin);
  } catch (erreur) {
    return erreur instanceof Error ? erreur.message : "Erreur lors de l'activation";
  }

  revalidatePath('/etablissement/annees-scolaires');
  return null;
}

export async function cloturerAnnee(pin: string, donnees: FormData): Promise<string | null> {
  const anneeScolaireId = String(donnees.get('anneeScolaireId') ?? '');
  if (!anneeScolaireId) return 'Année scolaire introuvable.';

  try {
    await cloturerAnneeScolaire(anneeScolaireId, pin);
  } catch (erreur) {
    return erreur instanceof Error ? erreur.message : 'Erreur lors de la clôture';
  }

  revalidatePath('/etablissement/annees-scolaires');
  return null;
}

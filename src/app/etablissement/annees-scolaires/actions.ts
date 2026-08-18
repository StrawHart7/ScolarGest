'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createAnneeScolaire, activerAnneeScolaire } from '@/services/annee-scolaire';

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

  try {
    await createAnneeScolaire(parsed.data);
  } catch (e) {
    return e instanceof Error ? e.message : 'Erreur lors de la création';
  }

  redirect('/etablissement/annees-scolaires');
}

export async function activerAnnee(anneeScolaireId: string): Promise<void> {
  await activerAnneeScolaire(anneeScolaireId);
  revalidatePath('/etablissement/annees-scolaires');
}

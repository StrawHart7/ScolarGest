'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { creerInscriptionAvecFacture } from '@/services/inscription';

const schema = z.object({
  eleveId: z.string().uuid(),
  anneeScolaireId: z.string().uuid('Année scolaire requise'),
  classeId: z.string().uuid('Classe requise'),
});

export async function inscrireEleve(_prevState: string | null, formData: FormData): Promise<string> {
  const parsed = schema.safeParse({
    eleveId: formData.get('eleveId'),
    anneeScolaireId: formData.get('anneeScolaireId'),
    classeId: formData.get('classeId'),
  });

  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? 'Formulaire invalide';
  }

  const data = parsed.data;
  try {
    await creerInscriptionAvecFacture(data);
  } catch (e) {
    return e instanceof Error ? e.message : "Erreur lors de l'inscription";
  }

  redirect(`/etablissement/eleves/${data.eleveId}`);
}

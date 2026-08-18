'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClasse } from '@/services/classe';

const schema = z.object({
  anneeScolaireId: z.string().uuid('Année scolaire requise'),
  niveauId: z.string().uuid('Niveau requis'),
  serieId: z.string().nullable().optional(),
  nom: z.string().min(1, 'Nom de la classe requis'),
  capacite: z.string().nullable().optional(),
});

export async function creerClasse(_prevState: string | null, formData: FormData): Promise<string> {
  const parsed = schema.safeParse({
    anneeScolaireId: formData.get('anneeScolaireId'),
    niveauId: formData.get('niveauId'),
    serieId: formData.get('serieId'),
    nom: formData.get('nom'),
    capacite: formData.get('capacite'),
  });

  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? 'Formulaire invalide';
  }

  const data = parsed.data;

  try {
    await createClasse({
      anneeScolaireId: data.anneeScolaireId,
      niveauId: data.niveauId,
      serieId: data.serieId || null,
      nom: data.nom,
      capacite: data.capacite ? Number(data.capacite) : null,
    });
  } catch (e) {
    return e instanceof Error ? e.message : 'Erreur lors de la création';
  }

  redirect(`/etablissement/classes?anneeScolaireId=${data.anneeScolaireId}`);
}

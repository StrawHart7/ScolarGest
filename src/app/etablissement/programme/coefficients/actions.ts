'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { definirCoefficient } from '@/services/coefficient';

const schema = z.object({
  programmeEtablissementId: z.string().uuid(),
  anneeScolaireId: z.string().uuid(),
  serieId: z.string().uuid().optional(),
  coefficient: z.coerce.number().min(0, 'Le coefficient doit être positif ou nul'),
});

export async function definirCoefficientAction(
  _prevState: string | null,
  formData: FormData,
): Promise<string | null> {
  const parsed = schema.safeParse({
    programmeEtablissementId: formData.get('programmeEtablissementId'),
    anneeScolaireId: formData.get('anneeScolaireId'),
    serieId: formData.get('serieId') || undefined,
    coefficient: formData.get('coefficient'),
  });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? 'Formulaire invalide';
  }

  try {
    await definirCoefficient(
      parsed.data.programmeEtablissementId,
      parsed.data.anneeScolaireId,
      parsed.data.serieId ?? null,
      parsed.data.coefficient,
    );
  } catch (e) {
    return e instanceof Error ? e.message : "Erreur lors de l'enregistrement du coefficient";
  }

  revalidatePath('/etablissement/programme/coefficients');
  return null;
}

'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { ajouterMatiereAuProgramme, retirerDuProgramme } from '@/services/programme';

const ajoutSchema = z.object({
  niveauId: z.string().uuid('Niveau requis'),
  matiereId: z.string().uuid('Matière requise'),
  obligatoire: z.enum(['on']).optional(),
  ordreAffichage: z.string().optional(),
});

export async function ajouterAuProgrammeAction(
  _prevState: string | null,
  formData: FormData,
): Promise<string | null> {
  const parsed = ajoutSchema.safeParse({
    niveauId: formData.get('niveauId'),
    matiereId: formData.get('matiereId'),
    obligatoire: formData.get('obligatoire') || undefined,
    ordreAffichage: formData.get('ordreAffichage'),
  });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? 'Il manque une information : vérifiez les champs signalés, puis réessayez.';
  }

  const ordreAffichage = parsed.data.ordreAffichage ? Number(parsed.data.ordreAffichage) : 0;
  if (!Number.isFinite(ordreAffichage) || ordreAffichage < 0) {
    return "Ordre d'affichage invalide";
  }

  try {
    await ajouterMatiereAuProgramme(
      parsed.data.niveauId,
      parsed.data.matiereId,
      parsed.data.obligatoire === 'on',
      ordreAffichage,
    );
  } catch (e) {
    return e instanceof Error ? e.message : "Erreur lors de l'ajout au programme";
  }

  revalidatePath('/etablissement/programme');
  return 'OK';
}

const idSchema = z.string().uuid('Cette ligne n’a pas pu être identifiée. Rechargez la page et réessayez.');

export async function retirerDuProgrammeAction(id: string): Promise<string | null> {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return parsed.error.issues[0]?.message ?? 'Cette ligne n’a pas pu être identifiée. Rechargez la page et réessayez.';

  try {
    await retirerDuProgramme(parsed.data);
  } catch (e) {
    return e instanceof Error ? e.message : 'Erreur lors du retrait';
  }

  revalidatePath('/etablissement/programme');
  return null;
}

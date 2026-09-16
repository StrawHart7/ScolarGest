'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { changerClasseInscription, creerInscriptionAvecFacture } from '@/services/inscription';

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
    return parsed.error.issues[0]?.message ?? 'Il manque une information : vérifiez les champs signalés, puis réessayez.';
  }

  const data = parsed.data;
  try {
    await creerInscriptionAvecFacture(data);
  } catch (e) {
    return e instanceof Error ? e.message : "Erreur lors de l'inscription";
  }

  redirect(`/etablissement/eleves/${data.eleveId}`);
}

const changementSchema = z.object({
  eleveId: z.string().uuid(),
  inscriptionId: z.string().uuid('Inscription requise'),
  classeId: z.string().uuid('Classe requise'),
});

/**
 * Change la classe d'un élève déjà inscrit — et réactive son inscription si
 * elle avait été annulée.
 *
 * Deux actions et non une, alors que l'écran est le même : inscrire **crée**
 * une ligne, changer de classe en **modifie** une, et les deux passent par des
 * RPC différentes. Les fondre derrière un seul nom obligerait l'action à
 * deviner laquelle appeler — alors que la page, qui a lu l'état de l'élève, le
 * sait sans deviner.
 */
export async function changerClasseAction(
  _prevState: string | null,
  formData: FormData,
): Promise<string> {
  const parsed = changementSchema.safeParse({
    eleveId: formData.get('eleveId'),
    inscriptionId: formData.get('inscriptionId'),
    classeId: formData.get('classeId'),
  });

  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? 'Il manque une information : vérifiez les champs signalés, puis réessayez.';
  }

  const data = parsed.data;
  try {
    await changerClasseInscription(data.inscriptionId, data.classeId);
  } catch (e) {
    return e instanceof Error ? e.message : 'Erreur lors du changement de classe';
  }

  redirect(`/etablissement/eleves/${data.eleveId}`);
}

'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { changerMotDePasse } from '@/services/utilisateur';

const schema = z
  .object({
    ancien: z.string().min(1, 'Indiquez votre mot de passe actuel.'),
    nouveau: z.string().min(8, 'Le nouveau mot de passe doit faire au moins 8 caractères.'),
    confirmation: z.string().min(1, 'Retapez le nouveau mot de passe.'),
  })
  .refine((v) => v.nouveau === v.confirmation, {
    message: 'Les deux mots de passe saisis ne sont pas identiques.',
  });

export async function changerMotDePasseAction(
  _prevState: string | null,
  formData: FormData,
): Promise<string> {
  const parsed = schema.safeParse({
    ancien: formData.get('ancien'),
    nouveau: formData.get('nouveau'),
    confirmation: formData.get('confirmation'),
  });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? 'Vérifiez les champs signalés, puis réessayez.';
  }

  try {
    await changerMotDePasse(parsed.data.ancien, parsed.data.nouveau);
  } catch (e) {
    return e instanceof Error ? e.message : 'Erreur lors du changement de mot de passe';
  }

  redirect('/dashboard?motDePasseChange=1');
}

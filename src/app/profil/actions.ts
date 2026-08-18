'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { definirPin } from '@/services/utilisateur';

const schema = z
  .object({
    pin: z.string().regex(/^\d{6}$/, 'Le PIN doit contenir exactement 6 chiffres'),
    confirmation: z.string(),
  })
  .refine((data) => data.pin === data.confirmation, {
    message: 'Les deux codes ne correspondent pas',
    path: ['confirmation'],
  });

export async function definirPinAction(
  _prevState: string | null,
  formData: FormData,
): Promise<string> {
  const parsed = schema.safeParse({
    pin: formData.get('pin'),
    confirmation: formData.get('confirmation'),
  });

  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? 'Formulaire invalide';
  }

  try {
    await definirPin(parsed.data.pin);
  } catch (e) {
    return e instanceof Error ? e.message : 'Erreur lors de la mise à jour du PIN';
  }

  revalidatePath('/profil');
  return 'OK';
}

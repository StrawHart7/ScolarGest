'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getTenantContext } from '@/services/tenant';
import { inviteUtilisateur, desactiverUtilisateur } from '@/services/utilisateur';

const schema = z.object({
  nom: z.string().min(1, 'Nom requis'),
  prenom: z.string().min(1, 'Prénom requis'),
  email: z.string().email('Email invalide'),
  role: z.enum(['SECRETAIRE', 'COMPTABLE', 'ENSEIGNANT']),
});

export async function inviterUtilisateur(
  _prevState: string | null,
  formData: FormData,
): Promise<string> {
  const parsed = schema.safeParse({
    nom: formData.get('nom'),
    prenom: formData.get('prenom'),
    email: formData.get('email'),
    role: formData.get('role'),
  });

  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? 'Formulaire invalide';
  }

  const ctx = await getTenantContext();

  try {
    await inviteUtilisateur({ ...parsed.data, etablissementId: ctx.etablissementId });
  } catch (e) {
    return e instanceof Error ? e.message : "Erreur lors de l'invitation";
  }

  redirect('/utilisateurs');
}

export async function desactiver(utilisateurId: string): Promise<void> {
  await desactiverUtilisateur(utilisateurId);
  revalidatePath('/utilisateurs');
}

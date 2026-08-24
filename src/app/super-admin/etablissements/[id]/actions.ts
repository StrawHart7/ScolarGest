'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { inviteUtilisateur } from '@/services/utilisateur';

const schema = z.object({
  etablissementId: z.string().uuid('Établissement invalide'),
  nom: z.string().min(1, 'Nom requis'),
  prenom: z.string().min(1, 'Prénom requis'),
  email: z.string().email('Email invalide'),
});

/**
 * Ajoute un Directeur supplémentaire à un établissement existant. Un
 * établissement peut légitimement avoir plusieurs Directeurs affiliés
 * (direction partagée, transition, grand groupe scolaire) — `inviteUtilisateur`
 * ne l'empêchait déjà pas côté service, seule cette UI manquait.
 */
export async function inviterDirecteurAction(
  _prevState: string | null,
  formData: FormData,
): Promise<string | null> {
  const parsed = schema.safeParse({
    etablissementId: formData.get('etablissementId'),
    nom: formData.get('nom'),
    prenom: formData.get('prenom'),
    email: formData.get('email'),
  });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? 'Formulaire invalide';
  }

  try {
    await inviteUtilisateur({
      email: parsed.data.email,
      nom: parsed.data.nom,
      prenom: parsed.data.prenom,
      role: 'DIRECTEUR',
      etablissementId: parsed.data.etablissementId,
    });
  } catch (e) {
    return e instanceof Error ? e.message : "Erreur lors de l'invitation";
  }

  revalidatePath(`/super-admin/etablissements/${parsed.data.etablissementId}`);
  return null;
}

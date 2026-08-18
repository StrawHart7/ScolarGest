'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createEtablissement } from '@/services/etablissement';
import { inviteUtilisateur } from '@/services/utilisateur';

const schema = z.object({
  nom: z.string().min(2, "Le nom de l'établissement est requis"),
  ville: z.string().optional(),
  telephone: z.string().optional(),
  emailEtablissement: z.string().email().optional().or(z.literal('')),
  directeurNom: z.string().min(1, 'Le nom du directeur est requis'),
  directeurPrenom: z.string().min(1, 'Le prénom du directeur est requis'),
  directeurEmail: z.string().email("L'email du directeur doit être valide"),
});

export async function creerEtablissementEtDirecteur(
  _prevState: string | null,
  formData: FormData,
): Promise<string> {
  const parsed = schema.safeParse({
    nom: formData.get('nom'),
    ville: formData.get('ville'),
    telephone: formData.get('telephone'),
    emailEtablissement: formData.get('emailEtablissement'),
    directeurNom: formData.get('directeurNom'),
    directeurPrenom: formData.get('directeurPrenom'),
    directeurEmail: formData.get('directeurEmail'),
  });

  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? 'Formulaire invalide';
  }

  const data = parsed.data;

  try {
    const etablissement = await createEtablissement({
      nom: data.nom,
      ville: data.ville || undefined,
      telephone: data.telephone || undefined,
      email: data.emailEtablissement || undefined,
    });

    await inviteUtilisateur({
      email: data.directeurEmail,
      nom: data.directeurNom,
      prenom: data.directeurPrenom,
      role: 'DIRECTEUR',
      etablissementId: etablissement.id,
    });
  } catch (e) {
    return e instanceof Error ? e.message : 'Erreur lors de la création';
  }

  redirect('/super-admin');
}

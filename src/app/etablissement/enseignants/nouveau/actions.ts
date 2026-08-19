'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createEnseignant } from '@/services/enseignant';

const schema = z.object({
  nom: z.string().min(1, 'Nom requis'),
  prenoms: z.string().min(1, 'Prénoms requis'),
  sexe: z.enum(['M', 'F'], { errorMap: () => ({ message: 'Sexe requis' }) }),
  email: z.string().min(1, 'Email requis').email('Email invalide'),
  telephone: z.string().optional(),
  adresse: z.string().optional(),
  dateNaissance: z.string().optional(),
  dateEmbauche: z.string().optional(),
  ancienMatricule: z.string().optional(),
  statut: z.enum(['ACTIF', 'INACTIF', 'CONGE', 'DEPART']).optional(),
  anneeScolaireIdPourMatricule: z.string().uuid('Année scolaire requise'),
});

export async function creerEnseignant(_prevState: string | null, formData: FormData): Promise<string> {
  const raw = formData.get('payload');
  const dateNaissance = formData.get('dateNaissance');
  const dateEmbauche = formData.get('dateEmbauche');
  if (typeof raw !== 'string') return 'Formulaire invalide';

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return 'Formulaire invalide';
  }

  const merged =
    typeof parsedJson === 'object' && parsedJson !== null
      ? {
          ...parsedJson,
          dateNaissance: typeof dateNaissance === 'string' && dateNaissance ? dateNaissance : undefined,
          dateEmbauche: typeof dateEmbauche === 'string' && dateEmbauche ? dateEmbauche : undefined,
        }
      : parsedJson;

  const parsed = schema.safeParse(merged);
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? 'Formulaire invalide';
  }

  const data = parsed.data;
  let enseignantId: string;
  try {
    enseignantId = await createEnseignant({
      nom: data.nom,
      prenoms: data.prenoms,
      sexe: data.sexe,
      email: data.email,
      telephone: data.telephone || undefined,
      adresse: data.adresse || undefined,
      dateNaissance: data.dateNaissance || undefined,
      dateEmbauche: data.dateEmbauche || undefined,
      ancienMatricule: data.ancienMatricule || undefined,
      statut: data.statut,
      anneeScolaireIdPourMatricule: data.anneeScolaireIdPourMatricule,
    });
  } catch (e) {
    return e instanceof Error ? e.message : 'Erreur lors de la création';
  }

  redirect(`/etablissement/enseignants/${enseignantId}`);
}

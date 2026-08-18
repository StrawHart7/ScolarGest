'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createEleveAvecResponsables } from '@/services/eleve';

const responsableSchema = z.object({
  responsableId: z.string().uuid().optional(),
  nom: z.string().min(1).optional(),
  prenoms: z.string().min(1).optional(),
  telephone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  adresse: z.string().optional(),
  profession: z.string().optional(),
  type: z.enum(['PERE', 'MERE', 'TUTEUR', 'AUTRE']).optional(),
  lienParente: z.string().min(1, 'Lien de parenté requis'),
  principal: z.boolean().optional(),
});

const schema = z.object({
  nom: z.string().min(1, 'Nom requis'),
  prenoms: z.string().min(1, 'Prénoms requis'),
  sexe: z.enum(['M', 'F'], { errorMap: () => ({ message: 'Sexe requis' }) }),
  dateNaissance: z.string().min(1, 'Date de naissance requise'),
  lieuNaissance: z.string().optional(),
  nationalite: z.string().optional(),
  ancienMatricule: z.string().optional(),
  anneeScolaireIdPourMatricule: z.string().uuid('Année scolaire requise'),
  responsables: z.array(responsableSchema).min(1, 'Au moins un responsable requis'),
});

export async function creerEleve(_prevState: string | null, formData: FormData): Promise<string> {
  const raw = formData.get('payload');
  const dateNaissance = formData.get('dateNaissance');
  if (typeof raw !== 'string') return 'Formulaire invalide';

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return 'Formulaire invalide';
  }

  const merged =
    typeof parsedJson === 'object' && parsedJson !== null
      ? { ...parsedJson, dateNaissance: typeof dateNaissance === 'string' ? dateNaissance : '' }
      : parsedJson;

  const parsed = schema.safeParse(merged);
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? 'Formulaire invalide';
  }

  const data = parsed.data;
  let eleveId: string;
  try {
    eleveId = await createEleveAvecResponsables({
      nom: data.nom,
      prenoms: data.prenoms,
      sexe: data.sexe,
      dateNaissance: data.dateNaissance,
      lieuNaissance: data.lieuNaissance || undefined,
      nationalite: data.nationalite || undefined,
      ancienMatricule: data.ancienMatricule || undefined,
      anneeScolaireIdPourMatricule: data.anneeScolaireIdPourMatricule,
      responsables: data.responsables.map((r) => ({
        ...r,
        email: r.email || undefined,
      })),
    });
  } catch (e) {
    return e instanceof Error ? e.message : 'Erreur lors de la création';
  }

  redirect(`/etablissement/eleves/${eleveId}`);
}

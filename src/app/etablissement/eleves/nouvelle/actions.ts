'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createEleveAvecResponsables } from '@/services/eleve';
import { creerInscriptionAvecFacture } from '@/services/inscription';

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
  /** Absente quand le Directeur a choisi « je l'inscrirai plus tard ». */
  classeId: z.string().uuid('Classe invalide').optional(),
  responsables: z.array(responsableSchema).min(1, 'Au moins un responsable requis'),
});

export async function creerEleve(_prevState: string | null, formData: FormData): Promise<string> {
  const raw = formData.get('payload');
  const dateNaissance = formData.get('dateNaissance');
  if (typeof raw !== 'string') return 'Il manque une information : vérifiez les champs signalés, puis réessayez.';

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return 'Il manque une information : vérifiez les champs signalés, puis réessayez.';
  }

  const merged =
    typeof parsedJson === 'object' && parsedJson !== null
      ? { ...parsedJson, dateNaissance: typeof dateNaissance === 'string' ? dateNaissance : '' }
      : parsedJson;

  const parsed = schema.safeParse(merged);
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? 'Il manque une information : vérifiez les champs signalés, puis réessayez.';
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

  /**
   * L'inscription suit dans le même geste, et **après** la création.
   *
   * Les deux services existent depuis toujours ; c'est l'écran qui les
   * séparait. On les compose ici plutôt que de toucher au service : chacun
   * garde sa garde de rôle, son `auditLog` et sa transaction.
   *
   * L'ordre n'est pas négociable — `creerInscriptionAvecFacture` a besoin de
   * l'identifiant de l'élève. Et si l'inscription échoue, **l'élève reste
   * créé** : le détruire ferait perdre une saisie de dix champs pour un tarif
   * mal configuré. On le dit, et la fiche porte le geste qui reste à faire.
   */
  if (data.classeId) {
    try {
      await creerInscriptionAvecFacture({
        eleveId,
        anneeScolaireId: data.anneeScolaireIdPourMatricule,
        classeId: data.classeId,
      });
    } catch (e) {
      const cause = e instanceof Error ? e.message : 'raison inconnue';
      return `L’élève est enregistré, mais son inscription en classe a échoué (${cause}). Ouvrez sa fiche pour l’inscrire.`;
    }
  }

  redirect(`/etablissement/eleves/${eleveId}`);
}

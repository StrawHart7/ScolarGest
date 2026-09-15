'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createEnseignant } from '@/services/enseignant';

const schema = z.object({
  nom: z.string().min(1, 'Nom requis'),
  prenoms: z.string().min(1, 'Prénoms requis'),
  sexe: z.enum(['M', 'F'], { errorMap: () => ({ message: 'Sexe requis' }) }),
  // L'un **ou** l'autre, vérifié plus bas : beaucoup d'enseignants togolais
  // n'ont pas d'adresse email, et exiger les deux reviendrait à n'avoir rien
  // changé.
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  identifiant: z.string().optional(),
  telephone: z.string().optional(),
  adresse: z.string().optional(),
  dateNaissance: z.string().optional(),
  dateEmbauche: z.string().optional(),
  ancienMatricule: z.string().optional(),
  statut: z.enum(['ACTIF', 'INACTIF', 'CONGE', 'DEPART']).optional(),
  anneeScolaireIdPourMatricule: z.string().uuid('Année scolaire requise'),
});

/**
 * Un enseignant créé par identifiant repart avec un mot de passe provisoire à
 * recopier. Il est rendu **dans la réponse**, jamais dans l'URL : une URL entre
 * dans l'historique du navigateur, dans l'en-tête `Referer` du premier lien
 * sortant et dans les journaux du serveur. Un secret qui traverse trois
 * endroits qu'on ne contrôle pas n'en est plus un.
 */
export type ResultatCreationEnseignant =
  | { etat: 'ERREUR'; message: string }
  | { etat: 'CREE'; enseignantId: string; nomComplet: string; identifiant: string; motDePasse: string }
  | null;

export async function creerEnseignant(
  _prevState: ResultatCreationEnseignant,
  formData: FormData,
): Promise<ResultatCreationEnseignant> {
  const echec = (message: string): ResultatCreationEnseignant => ({ etat: 'ERREUR', message });
  const raw = formData.get('payload');
  const dateNaissance = formData.get('dateNaissance');
  const dateEmbauche = formData.get('dateEmbauche');
  if (typeof raw !== 'string')
    return echec('Il manque une information : vérifiez les champs signalés, puis réessayez.');

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return echec('Il manque une information : vérifiez les champs signalés, puis réessayez.');
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
    return echec(
      parsed.error.issues[0]?.message ??
        'Il manque une information : vérifiez les champs signalés, puis réessayez.',
    );
  }

  const data = parsed.data;
  if (!data.email && !data.identifiant) {
    return echec(
      'Indiquez une adresse email, ou un identifiant de connexion si cet enseignant n’en a pas.',
    );
  }

  let cree;
  try {
    cree = await createEnseignant({
      nom: data.nom,
      prenoms: data.prenoms,
      sexe: data.sexe,
      email: data.email || undefined,
      identifiant: data.identifiant || undefined,
      telephone: data.telephone || undefined,
      adresse: data.adresse || undefined,
      dateNaissance: data.dateNaissance || undefined,
      dateEmbauche: data.dateEmbauche || undefined,
      ancienMatricule: data.ancienMatricule || undefined,
      statut: data.statut,
      anneeScolaireIdPourMatricule: data.anneeScolaireIdPourMatricule,
    });
  } catch (e) {
    return echec(e instanceof Error ? e.message : 'Erreur lors de la création');
  }

  // Compte par identifiant : l'écran doit d'abord montrer le mot de passe, une
  // seule fois. Rediriger tout de suite le perdrait sans recours.
  if (cree.motDePasseProvisoire) {
    return {
      etat: 'CREE',
      enseignantId: cree.id,
      nomComplet: `${data.prenoms} ${data.nom}`,
      identifiant: cree.identifiant ?? '',
      motDePasse: cree.motDePasseProvisoire,
    };
  }

  redirect(`/etablissement/enseignants/${cree.id}`);
}

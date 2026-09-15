'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getTenantContext } from '@/services/tenant';
import {
  inviteUtilisateur,
  creerCompteSansEmail,
  reinitialiserMotDePasse,
  desactiverUtilisateur,
  reactiverUtilisateur,
} from '@/services/utilisateur';

/**
 * Deux façons d'ouvrir un compte, et une seule action.
 *
 * Par email, l'invité reçoit un lien et choisit son mot de passe : c'est le
 * chemin autonome, et il reste le premier proposé. Par identifiant, le compte
 * est prêt tout de suite et le directeur remet le mot de passe de la main à la
 * main — c'est le seul chemin praticable pour la majorité des enseignants
 * togolais, qui n'ont pas d'adresse email.
 */
export type ResultatCreationCompte =
  | { etat: 'ERREUR'; message: string }
  | {
      etat: 'CREE';
      nomComplet: string;
      identifiant: string;
      /**
       * Montré une seule fois. Il ne repasse par aucune autre réponse : le
       * relire exigerait de le stocker en clair, et le reprendre plus tard
       * passe par une réinitialisation, qui est tracée.
       */
      motDePasse: string;
    }
  | null;

const communs = {
  nom: z.string().min(1, 'Nom requis'),
  prenom: z.string().min(1, 'Prénom requis'),
  role: z.enum(['SECRETAIRE', 'COMPTABLE', 'ENSEIGNANT']),
};

const schemaEmail = z.object({
  ...communs,
  mode: z.literal('EMAIL'),
  email: z.string().email('Email invalide'),
});

const schemaIdentifiant = z.object({
  ...communs,
  mode: z.literal('IDENTIFIANT'),
  identifiant: z.string().min(3, 'Identifiant trop court (trois caractères au moins)'),
});

const schema = z.discriminatedUnion('mode', [schemaEmail, schemaIdentifiant]);

export async function inviterUtilisateur(
  _prevState: ResultatCreationCompte,
  formData: FormData,
): Promise<ResultatCreationCompte> {
  const parsed = schema.safeParse({
    mode: formData.get('mode') ?? 'EMAIL',
    nom: formData.get('nom'),
    prenom: formData.get('prenom'),
    email: formData.get('email') || undefined,
    identifiant: formData.get('identifiant') || undefined,
    role: formData.get('role'),
  });

  if (!parsed.success) {
    return {
      etat: 'ERREUR',
      message:
        parsed.error.issues[0]?.message ??
        'Il manque une information : vérifiez les champs signalés, puis réessayez.',
    };
  }

  const ctx = await getTenantContext();

  if (parsed.data.mode === 'IDENTIFIANT') {
    try {
      const cree = await creerCompteSansEmail({
        identifiant: parsed.data.identifiant,
        nom: parsed.data.nom,
        prenom: parsed.data.prenom,
        role: parsed.data.role,
        etablissementId: ctx.etablissementId,
      });
      revalidatePath('/utilisateurs');
      return {
        etat: 'CREE',
        nomComplet: `${parsed.data.prenom} ${parsed.data.nom}`,
        identifiant: cree.identifiant,
        motDePasse: cree.motDePasseProvisoire,
      };
    } catch (e) {
      return {
        etat: 'ERREUR',
        message: e instanceof Error ? e.message : 'Erreur lors de la création du compte',
      };
    }
  }

  try {
    await inviteUtilisateur({
      email: parsed.data.email,
      nom: parsed.data.nom,
      prenom: parsed.data.prenom,
      role: parsed.data.role,
      etablissementId: ctx.etablissementId,
    });
  } catch (e) {
    return {
      etat: 'ERREUR',
      message: e instanceof Error ? e.message : "Erreur lors de l'invitation",
    };
  }

  redirect('/utilisateurs');
}

export type ResultatReinitialisation =
  | { etat: 'ERREUR'; message: string }
  | { etat: 'FAIT'; motDePasse: string }
  | null;

export async function reinitialiser(
  utilisateurId: string,
  pin: string,
): Promise<ResultatReinitialisation> {
  try {
    const motDePasse = await reinitialiserMotDePasse(utilisateurId, pin);
    revalidatePath('/utilisateurs');
    return { etat: 'FAIT', motDePasse };
  } catch (e) {
    return {
      etat: 'ERREUR',
      message: e instanceof Error ? e.message : 'Erreur lors de la réinitialisation',
    };
  }
}

export async function desactiver(utilisateurId: string): Promise<void> {
  await desactiverUtilisateur(utilisateurId);
  revalidatePath('/utilisateurs');
}

export async function reactiver(utilisateurId: string): Promise<void> {
  await reactiverUtilisateur(utilisateurId);
  revalidatePath('/utilisateurs');
}

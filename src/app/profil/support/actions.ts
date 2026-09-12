'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { creerDemandeSupport, getLienPieceJointeReponse } from '@/services/support';

export interface ResultatSupport {
  ok: boolean;
  message: string;
}

const schema = z.object({
  categorie: z.enum([
    'COMPTE_ACCES',
    'NOTES_BULLETINS',
    'FINANCES',
    'ABONNEMENT_PAIEMENT',
    'ANOMALIE',
    'AUTRE',
  ]),
  // Un sujet d'un mot ne dit rien et force un aller-retour ; un sujet long est
  // en fait le message. On borne les deux côtés.
  sujet: z.string().trim().min(5, 'Résumez votre demande en quelques mots.').max(150),
  message: z
    .string()
    .trim()
    .min(20, 'Décrivez le problème : ce que vous faisiez, ce qui s’est passé.')
    .max(4000),
  pageOrigine: z.string().trim().max(300).optional().nullable(),
});

/**
 * Envoie une demande au support.
 *
 * Le résultat est renvoyé plutôt que `redirect()` : le formulaire est sur la
 * page qui liste déjà les demandes de l'école, un `revalidatePath` suffit à
 * faire apparaître la nouvelle en tête.
 */
export async function envoyerDemandeSupportAction(
  _precedent: ResultatSupport,
  formData: FormData,
): Promise<ResultatSupport> {
  const valide = schema.safeParse({
    categorie: formData.get('categorie'),
    sujet: formData.get('sujet'),
    message: formData.get('message'),
    pageOrigine: formData.get('pageOrigine') || null,
  });
  if (!valide.success) {
    return {
      ok: false,
      message: valide.error.issues[0]?.message ?? 'Demande incomplète.',
    };
  }

  try {
    await creerDemandeSupport(valide.data);
    revalidatePath('/profil/support');
    return {
      ok: true,
      message: 'Demande envoyée. Vous la retrouvez ci-dessous, avec la réponse dès qu’elle arrive.',
    };
  } catch (e) {
    // Les erreurs Supabase ne sont pas des `Error` : `e instanceof Error` est
    // toujours faux sur un refus RLS ou une contrainte violée, et masquerait
    // la cause réelle derrière un message générique.
    if (e instanceof Error) return { ok: false, message: e.message };
    if (typeof e === 'object' && e !== null) {
      const m = (e as { message?: unknown }).message;
      if (typeof m === 'string' && m.trim() !== '') return { ok: false, message: m };
    }
    return { ok: false, message: 'Envoi impossible. Vérifiez votre connexion puis réessayez.' };
  }
}

/**
 * Lien de telechargement du fichier joint par le support a sa reponse.
 *
 * Emis a la demande plutot que rendu dans la page : l'URL signee expire au
 * bout de cinq minutes, et une page mise en cache porterait un lien mort qui
 * afficherait « fichier introuvable » sans rien expliquer.
 *
 * Seul l'identifiant de la demande est accepte. Le chemin de stockage est relu
 * cote serveur — le recevoir en parametre ferait de cette action un lecteur
 * universel du bucket.
 */
export async function lienPieceJointeReponseAction(
  demandeId: string,
): Promise<{ ok: boolean; url?: string; message?: string }> {
  const valide = z.string().uuid().safeParse(demandeId);
  if (!valide.success) return { ok: false, message: 'Demande invalide.' };
  try {
    const url = await getLienPieceJointeReponse(valide.data);
    if (!url) return { ok: false, message: 'Aucun fichier joint a cette reponse.' };
    return { ok: true, url };
  } catch (e) {
    // Les erreurs Supabase ne sont pas des `Error` — voir CLAUDE.md.
    if (e instanceof Error) return { ok: false, message: e.message };
    if (typeof e === 'object' && e !== null) {
      const m = (e as { message?: unknown }).message;
      if (typeof m === 'string' && m.trim() !== '') return { ok: false, message: m };
    }
    return { ok: false, message: 'Telechargement impossible. Reessayez.' };
  }
}

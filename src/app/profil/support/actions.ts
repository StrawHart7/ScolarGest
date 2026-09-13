'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { creerDemandeSupport } from '@/services/support';
import { executerUneSeuleFois } from '@/services/synchronisation';
import { messageErreur } from '@/lib/offline/operations';
import {
  cheminSansParametres,
  messageIncident,
  sujetIncident,
  type ContexteIncident,
} from '@/lib/support-incident';

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
 * Contexte accepte de l'appelant. Chaque champ est borne : il vient du
 * navigateur, donc d'un endroit qu'on ne controle pas.
 */
const contexteSchema = z.object({
  reference: z.string().trim().max(100).nullable(),
  chemin: z.string().trim().max(200),
  message: z.string().trim().max(600),
  survenuLe: z.string().trim().max(40),
  horsLigne: z.boolean(),
  ecran: z.string().trim().max(40).nullable(),
  navigateur: z.string().trim().max(300).nullable(),
  version: z.string().trim().max(40).nullable(),
});

const incidentSchema = z.object({
  description: z.string().trim().max(2000),
  contexte: contexteSchema,
});

export interface EntreeSignalement {
  description: string;
  contexte: ContexteIncident;
}

/**
 * Signale une panne depuis la page d'erreur.
 *
 * Rend `null` en cas de succes et un message autrement — le contrat qu'attend
 * la file d'ecritures differees (`exigerSucces`), et non le `ResultatSupport`
 * de l'envoi manuel. Une panne arrive souvent *parce que* le reseau est
 * mauvais : ce signalement doit pouvoir partir en differe, sinon la
 * fonctionnalite echouerait precisement quand elle sert.
 *
 * **Le chemin est renettoye ici**, alors que le client l'a deja fait. Le client
 * peut mentir ou etre d'une version anterieure ; laisser passer une query
 * string ferait entrer dans le ticket la recherche libre tapee par
 * l'utilisateur — sur `/etablissement/eleves`, c'est un nom d'eleve.
 *
 * `executerUneSeuleFois` n'est appele que si une cle est fournie, c'est-a-dire
 * uniquement pour un envoi differe. En attacher une a un envoi direct ferait
 * passer le signalement suivant pour un rejeu.
 */
export async function signalerIncidentAction(
  entree: EntreeSignalement,
  cleOperation?: string,
): Promise<string | null> {
  const valide = incidentSchema.safeParse(entree);
  if (!valide.success) return 'Signalement incomplet.';

  const contexte: ContexteIncident = {
    ...valide.data.contexte,
    chemin: cheminSansParametres(valide.data.contexte.chemin),
  };

  const deposer = () =>
    creerDemandeSupport({
      categorie: 'ANOMALIE',
      sujet: sujetIncident(contexte),
      message: messageIncident(contexte, valide.data.description),
      pageOrigine: contexte.chemin,
    });

  try {
    if (cleOperation) {
      await executerUneSeuleFois(cleOperation, 'SIGNALEMENT_INCIDENT', deposer);
    } else {
      await deposer();
    }
    revalidatePath('/profil/support');
    return null;
  } catch (e) {
    return messageErreur(e);
  }
}

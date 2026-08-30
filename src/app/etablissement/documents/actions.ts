'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  enregistrerParametresDocument,
  televerserLogo,
  supprimerLogo,
} from '@/services/parametres-document';

export type ResultatParametres = { ok: true; message?: string } | { ok: false; message: string };

/**
 * Les services propagent les erreurs Supabase telles quelles, et ce sont des
 * objets simples : `e instanceof Error` y est faux et masquerait la cause
 * réelle derrière un message générique.
 */
function messageErreur(e: unknown, repli: string): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'object' && e !== null) {
    const objet = e as { message?: unknown };
    if (typeof objet.message === 'string' && objet.message.trim() !== '') return objet.message;
  }
  return repli;
}

const filigraneSchema = z.object({
  filigraneTexte: z.string().max(60, 'Le filigrane est limité à 60 caractères.').nullable(),
  filigraneActif: z.boolean(),
});

export async function enregistrerFiligraneAction(
  entree: z.input<typeof filigraneSchema>,
): Promise<ResultatParametres> {
  const valide = filigraneSchema.safeParse(entree);
  if (!valide.success) {
    return { ok: false, message: valide.error.errors[0]?.message ?? 'Saisie invalide.' };
  }
  try {
    await enregistrerParametresDocument(valide.data);
    revalidatePath('/etablissement/documents');
    return { ok: true, message: 'Paramètres enregistrés.' };
  } catch (e) {
    return { ok: false, message: messageErreur(e, "Impossible d'enregistrer les paramètres.") };
  }
}

export async function televerserLogoAction(donnees: FormData): Promise<ResultatParametres> {
  const fichier = donnees.get('logo');
  if (!(fichier instanceof File) || fichier.size === 0) {
    return { ok: false, message: 'Sélectionnez un fichier.' };
  }
  try {
    await televerserLogo(fichier);
    revalidatePath('/etablissement/documents');
    return { ok: true, message: 'Logo enregistré.' };
  } catch (e) {
    return { ok: false, message: messageErreur(e, "Impossible d'envoyer le logo.") };
  }
}

export async function supprimerLogoAction(): Promise<ResultatParametres> {
  try {
    await supprimerLogo();
    revalidatePath('/etablissement/documents');
    return { ok: true, message: 'Logo retiré.' };
  } catch (e) {
    return { ok: false, message: messageErreur(e, 'Impossible de retirer le logo.') };
  }
}

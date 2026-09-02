'use server';

import { z } from 'zod';
import { getUrlTelechargementDocument } from '@/services/document';

const uuidSchema = z.string().uuid();

export interface TelechargementResult {
  error: string | null;
  url?: string;
}

/**
 * URL signée (5 minutes) vers le PDF d'un bulletin déjà édité.
 *
 * Le lien n'est pas rendu dans la page : une URL signée posée dans le HTML
 * serait périmée avant même que la page soit relue, et figurerait dans le
 * cache du navigateur. Elle est demandée au moment du clic.
 *
 * Le périmètre tenant est vérifié par `getUrlTelechargementDocument`, qui
 * relit le document avec la session avant de signer avec la clé service-role :
 * un identifiant forgé ne sort pas de son établissement.
 */
export async function telechargerBulletinAction(documentId: string): Promise<TelechargementResult> {
  const parsed = uuidSchema.safeParse(documentId);
  if (!parsed.success) return { error: 'Document invalide' };

  try {
    const url = await getUrlTelechargementDocument(parsed.data);
    return { error: null, url };
  } catch (e) {
    // Les erreurs Supabase ne sont pas des `Error` : un test `instanceof`
    // masquerait la cause réelle derrière un message générique.
    const message =
      e instanceof Error
        ? e.message
        : ((e as { message?: string })?.message ?? 'Le téléchargement a échoué.');
    return { error: message };
  }
}

'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  repondreDemandeSupport,
  changerStatutDemandeSupport,
  getLienPieceJointe,
  getLienPieceJointeReponse,
} from '@/services/support';
import { TAILLE_MAX_PIECE_JOINTE } from '@/lib/support';

export interface ResultatAction {
  ok: boolean;
  message: string;
}

const STATUTS = ['NOUVELLE', 'EN_COURS', 'RESOLUE', 'FERMEE'] as const;

const schemaReponse = z.object({
  id: z.string().uuid(),
  reponse: z.string().trim().min(1, 'La réponse est vide.').max(4000),
  statut: z.enum(STATUTS),
});

const schemaStatut = z.object({
  id: z.string().uuid(),
  statut: z.enum(STATUTS),
});

function messageErreur(e: unknown): string {
  // Les erreurs Supabase ne sont pas des `Error` — voir CLAUDE.md.
  if (e instanceof Error) return e.message;
  if (typeof e === 'object' && e !== null) {
    const m = (e as { message?: unknown }).message;
    if (typeof m === 'string' && m.trim() !== '') return m;
  }
  return 'Opération impossible.';
}

/**
 * Répond à une demande, avec ou sans fichier joint.
 *
 * L'argument est un `FormData` et non trois chaînes : un `File` doit voyager
 * avec la réponse, et c'est la forme que le dépôt emploie partout ailleurs
 * pour un envoi de fichier (voir `import-support-actions.ts`).
 *
 * Le fichier est **facultatif, et son absence ne l'efface pas** : le champ de
 * réponse est prérempli à la réouverture, et corriger une phrase ne doit pas
 * retirer à l'école le fichier qu'on lui avait déjà envoyé.
 */
export async function repondreAction(formData: FormData): Promise<ResultatAction> {
  const valide = schemaReponse.safeParse({
    id: formData.get('id'),
    reponse: formData.get('reponse'),
    statut: formData.get('statut'),
  });
  if (!valide.success) {
    return { ok: false, message: valide.error.issues[0]?.message ?? 'Réponse invalide.' };
  }

  const fichier = formData.get('fichier');
  const joint = fichier instanceof File && fichier.size > 0 ? fichier : null;
  // La taille est revérifiée ici alors que le service la contrôle déjà : le
  // refus arrive avant d'avoir chargé dix mégaoctets en mémoire, et le message
  // est celui que le support doit lire, pas une erreur de stockage.
  if (joint && joint.size > TAILLE_MAX_PIECE_JOINTE) {
    return { ok: false, message: 'Fichier trop volumineux (10 Mo maximum).' };
  }

  try {
    await repondreDemandeSupport(
      valide.data.id,
      valide.data.reponse,
      valide.data.statut,
      joint
        ? {
            nom: joint.name,
            type: joint.type || 'application/octet-stream',
            contenu: await joint.arrayBuffer(),
          }
        : null,
    );
    revalidatePath('/super-admin/support');
    revalidatePath('/super-admin');
    return {
      ok: true,
      message: joint ? 'Réponse et fichier envoyés.' : 'Réponse envoyée.',
    };
  } catch (e) {
    return { ok: false, message: messageErreur(e) };
  }
}

export async function changerStatutSupportAction(
  id: string,
  statut: string,
): Promise<ResultatAction> {
  const valide = schemaStatut.safeParse({ id, statut });
  if (!valide.success) {
    return { ok: false, message: 'Statut invalide.' };
  }
  try {
    await changerStatutDemandeSupport(valide.data.id, valide.data.statut);
    revalidatePath('/super-admin/support');
    revalidatePath('/super-admin');
    return { ok: true, message: 'Statut mis à jour.' };
  } catch (e) {
    return { ok: false, message: messageErreur(e) };
  }
}

/**
 * Lien de telechargement de la piece jointe.
 *
 * Emis a la demande plutot que rendu dans la page : une URL signee expire, et
 * une page mise en cache avec un lien mort donnerait un « fichier
 * introuvable » sans explication. L'identifiant de la demande est le seul
 * parametre — le chemin de stockage n'est jamais accepte de l'appelant.
 */
export async function lienPieceJointeReponseAction(
  demandeId: string,
): Promise<{ ok: boolean; url?: string; message?: string }> {
  const valide = z.string().uuid().safeParse(demandeId);
  if (!valide.success) return { ok: false, message: 'Demande invalide.' };
  try {
    const url = await getLienPieceJointeReponse(valide.data);
    if (!url) return { ok: false, message: 'Aucun fichier joint à cette réponse.' };
    return { ok: true, url };
  } catch (e) {
    return { ok: false, message: messageErreur(e) };
  }
}

export async function lienPieceJointeAction(
  demandeId: string,
): Promise<{ ok: boolean; url?: string; message?: string }> {
  const valide = z.string().uuid().safeParse(demandeId);
  if (!valide.success) return { ok: false, message: 'Demande invalide.' };
  try {
    const url = await getLienPieceJointe(valide.data);
    if (!url) return { ok: false, message: 'Aucune piece jointe sur cette demande.' };
    return { ok: true, url };
  } catch (e) {
    return { ok: false, message: messageErreur(e) };
  }
}

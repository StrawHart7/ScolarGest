'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { repondreDemandeSupport, changerStatutDemandeSupport } from '@/services/support';

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

export async function repondreAction(
  id: string,
  reponse: string,
  statut: string,
): Promise<ResultatAction> {
  const valide = schemaReponse.safeParse({ id, reponse, statut });
  if (!valide.success) {
    return { ok: false, message: valide.error.issues[0]?.message ?? 'Réponse invalide.' };
  }
  try {
    await repondreDemandeSupport(valide.data.id, valide.data.reponse, valide.data.statut);
    revalidatePath('/super-admin/support');
    revalidatePath('/super-admin');
    return { ok: true, message: 'Réponse envoyée.' };
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

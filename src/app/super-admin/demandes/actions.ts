'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { changerStatutDemande } from '@/services/demande-demo';

const schema = z.object({
  id: z.string().uuid(),
  statut: z.enum(['NOUVELLE', 'CONTACTEE', 'CONVERTIE', 'REJETEE']),
});

export async function changerStatutAction(
  id: string,
  statut: string,
): Promise<{ ok: boolean; message: string }> {
  const valide = schema.safeParse({ id, statut });
  if (!valide.success) {
    return { ok: false, message: 'Statut invalide.' };
  }
  try {
    await changerStatutDemande(valide.data.id, valide.data.statut);
    // La vue d'ensemble affiche le compte des demandes sans reponse : sans
    // cette invalidation, le bandeau d'alerte survivrait au traitement.
    revalidatePath('/super-admin/demandes');
    revalidatePath('/super-admin');
    return { ok: true, message: 'Statut mis a jour.' };
  } catch (e) {
    // Les erreurs Supabase ne sont pas des `Error` : lire `message` sur l'objet.
    if (e instanceof Error) return { ok: false, message: e.message };
    if (typeof e === 'object' && e !== null) {
      const m = (e as { message?: unknown }).message;
      if (typeof m === 'string' && m.trim() !== '') return { ok: false, message: m };
    }
    return { ok: false, message: 'Mise a jour impossible.' };
  }
}

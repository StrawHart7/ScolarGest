'use server';

import { revalidatePath } from 'next/cache';
import { activerCycle } from '@/services/structure';

/**
 * Renvoie `null` en cas de succès, le message d'erreur sinon : le modal de
 * confirmation par PIN distingue ainsi un PIN refusé d'une activation réussie.
 */
export async function activerCycleAction(pin: string, donnees: FormData): Promise<string | null> {
  const cycleId = String(donnees.get('cycleId') ?? '');
  if (!cycleId) return 'Cycle introuvable.';

  try {
    await activerCycle(cycleId, pin);
  } catch (erreur) {
    return erreur instanceof Error ? erreur.message : "Erreur lors de l'activation du cycle";
  }

  revalidatePath('/etablissement/cycles');
  return null;
}

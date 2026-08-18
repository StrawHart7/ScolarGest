'use server';

import { revalidatePath } from 'next/cache';
import { activerCycle } from '@/services/structure';

export async function activerCycleAction(cycleId: string): Promise<void> {
  await activerCycle(cycleId);
  revalidatePath('/etablissement/cycles');
}

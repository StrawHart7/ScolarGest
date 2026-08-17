'use server';

import { revalidatePath } from 'next/cache';
import { auditLog } from '@/services/audit';

export async function triggerTestAuditLog(): Promise<void> {
  await auditLog({
    action: 'TEST_DASHBOARD_BUTTON',
    module: 'debug',
    objetType: 'Dashboard',
    nouvelleValeur: { triggeredAt: new Date().toISOString() },
  });
  revalidatePath('/dashboard');
}

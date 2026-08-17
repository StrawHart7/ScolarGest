import { createClient } from '@/lib/supabase/server';
import { getTenantContext } from './tenant';

export interface AuditInput {
  action: string;
  module: string;
  objetType: string;
  objetId?: string;
  ancienneValeur?: unknown;
  nouvelleValeur?: unknown;
}

export async function auditLog(input: AuditInput): Promise<void> {
  const ctx = await getTenantContext();
  const supabase = createClient();
  const { error } = await supabase.from('audit_log').insert({
    etablissementId: ctx.etablissementId || null,
    userId: ctx.userId,
    action: input.action,
    module: input.module,
    objetType: input.objetType,
    objetId: input.objetId ?? null,
    ancienneValeur: input.ancienneValeur ?? null,
    nouvelleValeur: input.nouvelleValeur ?? null,
  });
  if (error) throw error;
}

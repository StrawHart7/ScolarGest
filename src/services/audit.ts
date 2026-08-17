import { prisma } from '@/lib/prisma';
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
  await prisma.auditLog.create({
    data: {
      etablissementId: ctx.etablissementId || null,
      userId: ctx.userId,
      action: input.action,
      module: input.module,
      objetType: input.objetType,
      objetId: input.objetId ?? null,
      ancienneValeur: (input.ancienneValeur ?? null) as never,
      nouvelleValeur: (input.nouvelleValeur ?? null) as never,
    },
  });
}

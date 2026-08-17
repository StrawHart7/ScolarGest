import type { TypeDocument } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getTenantContext } from './tenant';

const PREFIXES: Record<TypeDocument, string> = {
  BULLETIN: 'BUL',
  RECU: 'REC',
  RAPPORT: 'RAP',
};

function pad(n: number, width = 6): string {
  return String(n).padStart(width, '0');
}

/**
 * Numérotation par établissement × année scolaire × type.
 * Format: {PREFIX}-{YYYY}-{seq:06}. Année = année de début de l'année scolaire.
 */
export async function generateNumeroDocument(
  type: TypeDocument,
  anneeScolaireId: string,
): Promise<string> {
  const ctx = await getTenantContext();
  const annee = await prisma.anneeScolaire.findUnique({
    where: { id: anneeScolaireId },
    select: { dateDebut: true },
  });
  if (!annee) throw new Error('AnneeScolaire introuvable');
  const year = annee.dateDebut.getUTCFullYear();
  const prefix = `${PREFIXES[type]}-${year}-`;

  return prisma.$transaction(async (tx) => {
    const last = await tx.document.findFirst({
      where: { etablissementId: ctx.etablissementId, type, reference: { startsWith: prefix } },
      orderBy: { reference: 'desc' },
      select: { reference: true },
    });
    const nextSeq = last ? parseInt(last.reference.slice(prefix.length), 10) + 1 : 1;
    return `${prefix}${pad(nextSeq)}`;
  });
}

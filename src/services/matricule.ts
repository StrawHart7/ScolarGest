import { prisma } from '@/lib/prisma';
import { getTenantContext } from './tenant';

/**
 * Extrait l'année de début (YYYY) depuis la date de début de l'année scolaire.
 */
async function getAnneeDebut(anneeScolaireId: string): Promise<number> {
  const annee = await prisma.anneeScolaire.findUnique({
    where: { id: anneeScolaireId },
    select: { dateDebut: true },
  });
  if (!annee) throw new Error('AnneeScolaire introuvable');
  return annee.dateDebut.getUTCFullYear();
}

function pad(n: number, width = 4): string {
  return String(n).padStart(width, '0');
}

/**
 * Format: ELV-{YYYY}-{seq:04}.
 * TODO: remplacer le max+1 par une séquence Postgres dédiée par (etablissement, annee)
 * pour éviter les collisions sous forte concurrence.
 */
export async function generateMatriculeEleve(anneeScolaireId: string): Promise<string> {
  const ctx = await getTenantContext();
  const annee = await getAnneeDebut(anneeScolaireId);
  const prefix = `ELV-${annee}-`;

  return prisma.$transaction(async (tx) => {
    const last = await tx.eleve.findFirst({
      where: { etablissementId: ctx.etablissementId, matricule: { startsWith: prefix } },
      orderBy: { matricule: 'desc' },
      select: { matricule: true },
    });
    const nextSeq = last ? parseInt(last.matricule.slice(prefix.length), 10) + 1 : 1;
    return `${prefix}${pad(nextSeq)}`;
  });
}

export async function generateMatriculeEnseignant(anneeScolaireId: string): Promise<string> {
  const ctx = await getTenantContext();
  const annee = await getAnneeDebut(anneeScolaireId);
  const prefix = `ENS-${annee}-`;

  return prisma.$transaction(async (tx) => {
    const last = await tx.enseignant.findFirst({
      where: { etablissementId: ctx.etablissementId, matricule: { startsWith: prefix } },
      orderBy: { matricule: 'desc' },
      select: { matricule: true },
    });
    const nextSeq = last ? parseInt(last.matricule.slice(prefix.length), 10) + 1 : 1;
    return `${prefix}${pad(nextSeq)}`;
  });
}

'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { genererBulletin, regenererBulletin } from '@/services/bulletin';
import { getUrlTelechargementDocument } from '@/services/document';
import { listElevesInscritsClasse } from '@/services/eleve';
import type { Periode } from '@/services/evaluation';

const periodeSchema = z.enum(['TRIMESTRE_1', 'TRIMESTRE_2', 'TRIMESTRE_3']);
const uuidSchema = z.string().uuid();

export interface ActionResult {
  error: string | null;
  url?: string;
}

/** Génère le bulletin d'un seul élève et renvoie une URL de téléchargement. */
export async function genererBulletinAction(
  eleveId: string,
  classeId: string,
  periode: string,
  anneeScolaireId: string,
): Promise<ActionResult> {
  const parsedPeriode = periodeSchema.safeParse(periode);
  const parsedEleve = uuidSchema.safeParse(eleveId);
  const parsedClasse = uuidSchema.safeParse(classeId);
  const parsedAnnee = uuidSchema.safeParse(anneeScolaireId);
  if (!parsedPeriode.success || !parsedEleve.success || !parsedClasse.success || !parsedAnnee.success) {
    return { error: 'Paramètres invalides' };
  }

  try {
    const document = await genererBulletin(
      parsedEleve.data,
      parsedClasse.data,
      parsedPeriode.data as Periode,
      parsedAnnee.data,
    );
    const url = await getUrlTelechargementDocument(document.id);
    revalidatePath('/etablissement/notes/bulletins');
    revalidatePath(`/etablissement/eleves/${eleveId}/bulletins`);
    return { error: null, url };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur lors de la génération du bulletin' };
  }
}

/** Génère en masse les bulletins de tous les élèves actifs d'une classe. */
export async function genererBulletinsClasseAction(
  classeId: string,
  periode: string,
  anneeScolaireId: string,
): Promise<{ error: string | null; succes: number; echecs: number }> {
  const parsedPeriode = periodeSchema.safeParse(periode);
  const parsedClasse = uuidSchema.safeParse(classeId);
  const parsedAnnee = uuidSchema.safeParse(anneeScolaireId);
  if (!parsedPeriode.success || !parsedClasse.success || !parsedAnnee.success) {
    return { error: 'Paramètres invalides', succes: 0, echecs: 0 };
  }

  const eleves = await listElevesInscritsClasse(parsedClasse.data, parsedAnnee.data);
  let succes = 0;
  let echecs = 0;
  for (const eleve of eleves) {
    try {
      await genererBulletin(eleve.id, parsedClasse.data, parsedPeriode.data as Periode, parsedAnnee.data);
      succes += 1;
    } catch {
      echecs += 1;
    }
  }

  revalidatePath('/etablissement/notes/bulletins');
  return { error: null, succes, echecs };
}

export async function regenererBulletinAction(
  documentId: string,
  classeId: string,
  periode: string,
  anneeScolaireId: string,
  eleveId: string,
): Promise<ActionResult> {
  const parsedPeriode = periodeSchema.safeParse(periode);
  const parsedDocument = uuidSchema.safeParse(documentId);
  const parsedClasse = uuidSchema.safeParse(classeId);
  const parsedAnnee = uuidSchema.safeParse(anneeScolaireId);
  if (!parsedPeriode.success || !parsedDocument.success || !parsedClasse.success || !parsedAnnee.success) {
    return { error: 'Paramètres invalides' };
  }

  try {
    const document = await regenererBulletin(
      parsedDocument.data,
      parsedClasse.data,
      parsedPeriode.data as Periode,
      parsedAnnee.data,
    );
    const url = await getUrlTelechargementDocument(document.id);
    revalidatePath(`/etablissement/eleves/${eleveId}/bulletins`);
    return { error: null, url };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur lors de la régénération du bulletin' };
  }
}

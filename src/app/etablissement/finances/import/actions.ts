'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  preparerImportPaiements,
  executerImportPaiements,
  type ImportRapport,
} from '@/services/import-paiements';
import type { AnalyseImport } from '@/lib/import/analyse';

export interface AnalyseActionResult {
  ok: boolean;
  message?: string;
  analyse?: AnalyseImport;
}

export interface ImportActionResult {
  ok: boolean;
  message?: string;
  analyse?: AnalyseImport;
  rapport?: ImportRapport;
}

const anneeSchema = z.string().uuid();

async function lireEnvoi(
  formData: FormData,
): Promise<{ ok: true; buffer: Buffer; anneeScolaireId: string } | { ok: false; message: string }> {
  const annee = anneeSchema.safeParse(formData.get('anneeScolaireId'));
  if (!annee.success) return { ok: false, message: 'Année scolaire invalide' };

  const file = formData.get('fichier');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: 'Aucun fichier sélectionné' };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    return { ok: true, buffer, anneeScolaireId: annee.data };
  } catch {
    return { ok: false, message: 'Impossible de lire le fichier' };
  }
}

function messageErreur(e: unknown): string {
  // Les erreurs Supabase ne sont pas des `Error` : lire `message` sur l'objet.
  if (e instanceof Error) return e.message;
  if (typeof e === 'object' && e !== null) {
    const m = (e as { message?: unknown }).message;
    if (typeof m === 'string' && m.trim() !== '') return m;
  }
  return "Erreur lors de l'import";
}

/** Premier temps : analyser, sans rien écrire. */
export async function analyserFichierPaiements(
  formData: FormData,
): Promise<AnalyseActionResult> {
  const envoi = await lireEnvoi(formData);
  if (!envoi.ok) return { ok: false, message: envoi.message };

  try {
    const { analyse } = await preparerImportPaiements(envoi.buffer, envoi.anneeScolaireId);
    if (analyse.totalLignes === 0) {
      return { ok: false, message: 'Le fichier ne contient aucune ligne de données' };
    }
    return { ok: true, analyse };
  } catch (e) {
    return { ok: false, message: messageErreur(e) };
  }
}

/** Second temps : écrire. Le fichier est réanalysé côté serveur. */
export async function confirmerImportPaiements(
  formData: FormData,
): Promise<ImportActionResult> {
  const envoi = await lireEnvoi(formData);
  if (!envoi.ok) return { ok: false, message: envoi.message };

  try {
    const { analyse, rapport } = await executerImportPaiements(
      envoi.buffer,
      envoi.anneeScolaireId,
    );
    revalidatePath('/etablissement/finances');
    return { ok: true, analyse, rapport };
  } catch (e) {
    return { ok: false, message: messageErreur(e) };
  }
}

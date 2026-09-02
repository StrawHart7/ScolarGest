'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { preparerImportEleves, executerImportEleves } from '@/services/import-eleves';
import type { AnalyseImport } from '@/lib/import/analyse';
import type { ImportRapport } from '@/services/import-eleves';

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

/**
 * Lit le fichier envoyé, ou explique pourquoi il est illisible.
 *
 * Le message d'erreur distingue les trois causes — pas de fichier, classeur
 * corrompu, aucune ligne — parce qu'elles appellent trois gestes différents et
 * qu'un « import impossible » unique laisse l'utilisateur sans prise.
 */
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

/**
 * Premier temps : analyser, sans rien écrire.
 *
 * Renvoie le bilan que l'écran affiche avant confirmation. Aucune écriture
 * n'a lieu ici, y compris quand tout est valide.
 */
export async function analyserFichierEleves(formData: FormData): Promise<AnalyseActionResult> {
  const envoi = await lireEnvoi(formData);
  if (!envoi.ok) return { ok: false, message: envoi.message };

  try {
    const { analyse } = await preparerImportEleves(envoi.buffer, envoi.anneeScolaireId);
    if (analyse.totalLignes === 0) {
      return { ok: false, message: 'Le fichier ne contient aucune ligne de données' };
    }
    return { ok: true, analyse };
  } catch (e) {
    return { ok: false, message: messageErreur(e) };
  }
}

/**
 * Second temps : écrire.
 *
 * Le fichier est renvoyé et **réanalysé côté serveur** ; l'analyse affichée
 * n'est jamais reprise telle quelle depuis le navigateur. Conséquence assumée :
 * si les classes ou les élèves ont changé entre les deux temps, c'est l'état au
 * moment de l'écriture qui fait foi, et le rapport final le dira.
 */
export async function confirmerImportEleves(formData: FormData): Promise<ImportActionResult> {
  const envoi = await lireEnvoi(formData);
  if (!envoi.ok) return { ok: false, message: envoi.message };

  try {
    const { analyse, rapport } = await executerImportEleves(envoi.buffer, envoi.anneeScolaireId);
    revalidatePath('/etablissement/eleves');
    return { ok: true, analyse, rapport };
  } catch (e) {
    return { ok: false, message: messageErreur(e) };
  }
}

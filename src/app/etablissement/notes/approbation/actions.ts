'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  approuverModification,
  rejeterModification,
  validerSoumissionEvaluation,
  rejeterSoumissionEvaluation,
} from '@/services/note';

const idSchema = z.string().uuid();
// Exactement 6 chiffres — jamais logué en clair, y compris dans un message d'erreur.
const pinSchema = z.string().regex(/^\d{6}$/, 'Le PIN doit contenir exactement 6 chiffres');

export interface ApprobationResult {
  success: boolean;
  message: string;
}

export async function approuverModificationAction(
  noteId: string,
  pin: string,
): Promise<ApprobationResult> {
  const parsedId = idSchema.safeParse(noteId);
  if (!parsedId.success) return { success: false, message: 'Identifiant invalide' };
  const parsedPin = pinSchema.safeParse(pin);
  if (!parsedPin.success) {
    return { success: false, message: parsedPin.error.issues[0]?.message ?? 'PIN invalide' };
  }

  try {
    await approuverModification(parsedId.data, parsedPin.data);
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : 'Erreur lors de l\'approbation' };
  }

  revalidatePath('/etablissement/notes/approbation');
  return { success: true, message: 'Modification approuvée.' };
}

export async function rejeterModificationAction(
  noteId: string,
  pin: string,
  motif: string,
): Promise<ApprobationResult> {
  const parsedId = idSchema.safeParse(noteId);
  if (!parsedId.success) return { success: false, message: 'Identifiant invalide' };
  const parsedPin = pinSchema.safeParse(pin);
  if (!parsedPin.success) {
    return { success: false, message: parsedPin.error.issues[0]?.message ?? 'PIN invalide' };
  }
  const parsedMotif = z.string().trim().min(1, 'Motif de rejet requis').safeParse(motif);
  if (!parsedMotif.success) {
    return { success: false, message: parsedMotif.error.issues[0]?.message ?? 'Motif de rejet requis' };
  }

  try {
    await rejeterModification(parsedId.data, parsedPin.data, parsedMotif.data);
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : 'Erreur lors du rejet' };
  }

  revalidatePath('/etablissement/notes/approbation');
  return { success: true, message: 'Demande rejetée.' };
}

export async function validerSoumissionAction(
  evaluationId: string,
  pin: string,
): Promise<ApprobationResult> {
  const parsedId = idSchema.safeParse(evaluationId);
  if (!parsedId.success) return { success: false, message: 'Identifiant invalide' };
  const parsedPin = pinSchema.safeParse(pin);
  if (!parsedPin.success) {
    return { success: false, message: parsedPin.error.issues[0]?.message ?? 'PIN invalide' };
  }

  try {
    const nombre = await validerSoumissionEvaluation(parsedId.data, parsedPin.data);
    revalidatePath('/etablissement/notes/approbation');
    return { success: true, message: `${nombre} note(s) validée(s).` };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : 'Erreur lors de la validation' };
  }
}

export async function rejeterSoumissionAction(
  evaluationId: string,
  pin: string,
  motif: string,
): Promise<ApprobationResult> {
  const parsedId = idSchema.safeParse(evaluationId);
  if (!parsedId.success) return { success: false, message: 'Identifiant invalide' };
  const parsedPin = pinSchema.safeParse(pin);
  if (!parsedPin.success) {
    return { success: false, message: parsedPin.error.issues[0]?.message ?? 'PIN invalide' };
  }
  const parsedMotif = z.string().trim().min(1, 'Motif de rejet requis').safeParse(motif);
  if (!parsedMotif.success) {
    return { success: false, message: parsedMotif.error.issues[0]?.message ?? 'Motif de rejet requis' };
  }

  try {
    const nombre = await rejeterSoumissionEvaluation(parsedId.data, parsedPin.data, parsedMotif.data);
    revalidatePath('/etablissement/notes/approbation');
    return { success: true, message: `${nombre} note(s) renvoyée(s) en brouillon.` };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : 'Erreur lors du rejet' };
  }
}

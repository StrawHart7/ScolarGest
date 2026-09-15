'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  placerCreneau,
  retirerCreneau,
  detecterConflitPourMatiere,
} from '@/services/emploi-du-temps';
import { NOMBRE_JOURS, NOMBRE_RANGS } from '@/lib/emploi-du-temps';

/**
 * Actions de l'emploi du temps.
 *
 * Résultat typé `{ ok, message? }` plutôt qu'une exception : la grille est
 * pilotée depuis le client, et une action interrompue peut se résoudre sur
 * `undefined` (voir CLAUDE.md § « Server Actions »). L'appelant traite les
 * deux cas.
 *
 * Les erreurs Supabase ne sont pas des `Error` — `e instanceof Error` y est
 * toujours faux. On extrait le message et on reconnaît le doublon par le code
 * Postgres `23505` : c'est le refus de l'index unique sur l'enseignant, le
 * filet qui rattrape ce que l'avertissement préalable a manqué (deux saisies
 * simultanées).
 */

export interface ResultatAction {
  ok: boolean;
  message?: string;
}

function messageErreur(e: unknown): string {
  if (e && typeof e === 'object') {
    const err = e as { code?: string; message?: string; details?: string; hint?: string };
    if (err.code === '23505') {
      return "Ce créneau vient d'être occupé par ailleurs. Rechargez la grille.";
    }
    const texte = err.message ?? err.details ?? err.hint;
    if (texte) return texte;
  }
  return 'Une erreur est survenue.';
}

const SCHEMA_PLACER = z.object({
  classeId: z.string().uuid(),
  anneeScolaireId: z.string().uuid(),
  jour: z.coerce.number().int().min(1).max(NOMBRE_JOURS),
  rang: z.coerce.number().int().min(1).max(NOMBRE_RANGS),
  matiereId: z.string().uuid(),
  enseignantId: z.string().uuid().nullable().optional(),
  salle: z.string().trim().max(60).nullable().optional(),
  pin: z.string().min(4),
});

export async function placerCreneauAction(donnees: unknown): Promise<ResultatAction> {
  const analyse = SCHEMA_PLACER.safeParse(donnees);
  if (!analyse.success) {
    return { ok: false, message: 'Sélection incomplète.' };
  }
  const { pin, salle, ...reste } = analyse.data;
  try {
    await placerCreneau({ ...reste, salle: salle || null }, pin);
  } catch (e) {
    return { ok: false, message: messageErreur(e) };
  }
  revalidatePath(`/etablissement/classes/${analyse.data.classeId}`);
  return { ok: true };
}

const SCHEMA_RETIRER = z.object({
  id: z.string().uuid(),
  classeId: z.string().uuid(),
  pin: z.string().min(4),
});

export async function retirerCreneauAction(donnees: unknown): Promise<ResultatAction> {
  const analyse = SCHEMA_RETIRER.safeParse(donnees);
  if (!analyse.success) return { ok: false, message: 'Créneau introuvable.' };
  try {
    await retirerCreneau(analyse.data.id, analyse.data.pin);
  } catch (e) {
    return { ok: false, message: messageErreur(e) };
  }
  revalidatePath(`/etablissement/classes/${analyse.data.classeId}`);
  return { ok: true };
}

const SCHEMA_CONFLIT = z.object({
  // La matière depuis le 2026-09-15, et non plus l'enseignant : le formulaire
  // ne le demande plus, il se déduit de l'affectation. La résolution se fait
  // donc côté serveur, là où les affectations sont lisibles.
  classeId: z.string().uuid(),
  matiereId: z.string().uuid(),
  anneeScolaireId: z.string().uuid(),
  jour: z.coerce.number().int().min(1).max(NOMBRE_JOURS),
  rang: z.coerce.number().int().min(1).max(NOMBRE_RANGS),
  creneauIgnoreId: z.string().uuid().optional(),
});

export interface ResultatConflit extends ResultatAction {
  conflit?: { classeNom: string; matiereNom: string; enseignantNom: string } | null;
}

/**
 * Consultée pendant la saisie, avant l'enregistrement. Son seul rôle est de
 * produire une phrase : « M. Kossi assure déjà Mathématiques en 3ème A ».
 * La base refuse de toute façon — mais avec un code d'erreur.
 *
 * Elle reste **indispensable** alors que l'enseignant n'est plus saisi : c'est
 * précisément parce qu'il est déduit que le directeur ne voit pas venir le
 * conflit. Sans cette phrase, il choisirait une matière et recevrait un refus
 * sans comprendre lequel de ses professeurs est déjà pris.
 */
export async function verifierConflitAction(donnees: unknown): Promise<ResultatConflit> {
  const analyse = SCHEMA_CONFLIT.safeParse(donnees);
  if (!analyse.success) return { ok: false, message: 'Vérification impossible.' };
  try {
    const conflit = await detecterConflitPourMatiere(
      analyse.data.classeId,
      analyse.data.matiereId,
      analyse.data.anneeScolaireId,
      analyse.data.jour,
      analyse.data.rang,
      analyse.data.creneauIgnoreId,
    );
    return { ok: true, conflit };
  } catch (e) {
    return { ok: false, message: messageErreur(e) };
  }
}

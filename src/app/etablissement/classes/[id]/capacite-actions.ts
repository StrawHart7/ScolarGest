'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { definirCapaciteClasse } from '@/services/classe';

/**
 * Capacité d'une classe, posée après coup.
 *
 * Résultat typé `{ ok, message? }` plutôt qu'une exception, comme les actions
 * de l'emploi du temps : l'appel part d'un composant client, et une action
 * interrompue peut se résoudre sur `undefined` (CLAUDE.md § « Server Actions »).
 *
 * La valeur arrive en **objet**, pas en `FormData`. `formData.get` rend `null`
 * pour un champ absent là où Zod attend `undefined`, et c'est exactement le
 * piège qui a bloqué la création de tarifs la semaine dernière. Ici la chaîne
 * vide dit « pas de plafond » et se traduit explicitement en `null`.
 */

export interface ResultatCapacite {
  ok: boolean;
  message?: string;
}

const SCHEMA = z.object({
  classeId: z.string().uuid(),
  // `''` est un choix de l'utilisateur — retirer le plafond — et non un champ
  // manquant. Une capacité irréversible une fois posée serait un piège.
  capacite: z.union([z.literal(''), z.coerce.number().int().min(1).max(500)]),
});

export async function definirCapaciteAction(donnees: unknown): Promise<ResultatCapacite> {
  const analyse = SCHEMA.safeParse(donnees);
  if (!analyse.success) {
    return { ok: false, message: 'La capacité doit être un nombre entier entre 1 et 500.' };
  }

  const { classeId, capacite } = analyse.data;
  try {
    await definirCapaciteClasse(classeId, capacite === '' ? null : capacite);
  } catch (e) {
    // Les erreurs Supabase ne sont pas des `Error` : `instanceof` y est
    // toujours faux et masquerait la cause réelle derrière un texte générique.
    if (e && typeof e === 'object') {
      const err = e as { message?: string; details?: string; hint?: string };
      const texte = err.message ?? err.details ?? err.hint;
      if (texte) return { ok: false, message: texte };
    }
    return { ok: false, message: 'La capacité n’a pas pu être enregistrée.' };
  }

  revalidatePath(`/etablissement/classes/${classeId}`);
  revalidatePath('/etablissement/classes');
  return { ok: true };
}

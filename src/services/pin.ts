import bcrypt from 'bcrypt';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from './authorization';
import type { Role } from './tenant';

const ROUNDS = 12;
const PIN_REGEX = /^\d{6}$/;

export async function hashPin(pin: string): Promise<string> {
  if (!PIN_REGEX.test(pin)) throw new Error('Le PIN doit contenir exactement 6 chiffres');
  return bcrypt.hash(pin, ROUNDS);
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  if (!PIN_REGEX.test(pin)) return false;
  return bcrypt.compare(pin, hash);
}

/**
 * Step-up d'authentification : vérifie le PIN d'approbation de l'utilisateur
 * courant avant une action irréversible.
 *
 * Extrait de `note.ts`, où il était privé : le PIN n'était donc demandé que
 * sur l'approbation des notes, alors que le doc 03 l'exige sur l'ensemble des
 * actions sensibles (activation d'un cycle, activation d'une année scolaire,
 * clôture d'une année).
 */
export async function exigerPin(pin: string, ...roles: Role[]): Promise<void> {
  const ctx = roles.length > 0 ? await requireRole(...roles) : await requireRole('DIRECTEUR', 'SECRETAIRE');
  const supabase = createClient();
  const { data, error } = await supabase
    .from('utilisateur')
    .select('"pinApprobationHash"')
    .eq('id', ctx.userId)
    .single();
  if (error) throw error;
  if (!data.pinApprobationHash) {
    throw new Error(
      "Aucun PIN de confirmation n'est configuré pour votre compte. Définissez-le dans Paramètres.",
    );
  }
  if (!(await verifyPin(pin, data.pinApprobationHash as string))) {
    throw new Error('PIN invalide.');
  }
}

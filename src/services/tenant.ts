import * as React from 'react';
import { createClient } from '@/lib/supabase/server';

export type Role = 'SUPER_ADMIN' | 'DIRECTEUR' | 'SECRETAIRE' | 'COMPTABLE' | 'ENSEIGNANT';

export interface TenantContext {
  userId: string;
  etablissementId: string;
  role: Role;
  email: string;
}

/**
 * `React.cache` n'existe que dans le build « react-server » utilisé par Next :
 * sous Vitest (condition node), l'import est absent. On dégrade alors vers
 * l'identité — la mémoïsation est une optimisation de rendu, jamais une
 * condition de correction.
 */
const memoiserParRequete: <T extends (...args: never[]) => unknown>(fonction: T) => T =
  (React as { cache?: <T extends (...args: never[]) => unknown>(fonction: T) => T }).cache ??
  ((fonction) => fonction);

/**
 * Reads etablissement_id + role from Supabase JWT claims (app_metadata).
 * Configure a Supabase Auth Hook that injects both into app_metadata at token issue time.
 * SUPER_ADMIN may operate without an etablissementId — handled by callers.
 *
 * Mémoïsé par `cache()` sur la durée d'une requête : `requireRole()` appelle
 * ce contexte au début de *chaque* service, et `supabase.auth.getUser()` est
 * un aller-retour réseau vers Supabase Auth. Une page qui touche huit services
 * payait huit fois cette latence avant d'avoir lu la moindre donnée métier.
 * Le cache est par requête (React `cache`), donc jamais partagé entre deux
 * utilisateurs ni entre deux requêtes.
 */
export const getTenantContext = memoiserParRequete(async function getTenantContext(): Promise<TenantContext> {
  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error('Non authentifié');
  }

  const meta = (user.app_metadata ?? {}) as { etablissement_id?: string; role?: Role };
  const role = meta.role;
  const etablissementId = meta.etablissement_id;

  if (!role) {
    throw new Error('Contexte tenant invalide: role manquant dans app_metadata');
  }
  if (!etablissementId && role !== 'SUPER_ADMIN') {
    throw new Error('Contexte tenant invalide: etablissement_id manquant');
  }

  return {
    userId: user.id,
    etablissementId: etablissementId ?? '',
    role,
    email: user.email ?? '',
  };
});

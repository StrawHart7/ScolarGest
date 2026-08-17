import { createClient } from '@/lib/supabase/server';

export type Role = 'SUPER_ADMIN' | 'DIRECTEUR' | 'SECRETAIRE' | 'COMPTABLE' | 'ENSEIGNANT';

export interface TenantContext {
  userId: string;
  etablissementId: string;
  role: Role;
  email: string;
}

/**
 * Reads etablissement_id + role from Supabase JWT claims (app_metadata).
 * Configure a Supabase Auth Hook that injects both into app_metadata at token issue time.
 * SUPER_ADMIN may operate without an etablissementId — handled by callers.
 */
export async function getTenantContext(): Promise<TenantContext> {
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
}

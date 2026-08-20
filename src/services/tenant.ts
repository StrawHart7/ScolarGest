import { createClient } from '@/lib/supabase/server';
import { memoiserParRequete } from '@/lib/memo';

export type Role = 'SUPER_ADMIN' | 'DIRECTEUR' | 'SECRETAIRE' | 'COMPTABLE' | 'ENSEIGNANT';

export interface TenantContext {
  userId: string;
  etablissementId: string;
  role: Role;
  email: string;
}

interface IdentiteBrute {
  sub?: string;
  email?: string;
  app_metadata?: { etablissement_id?: string; role?: Role };
}

/**
 * Lit l'identité vérifiée du porteur du cookie de session.
 *
 * `getClaims()` plutôt que `getUser()` : le projet signe ses JWT avec une clé
 * asymétrique (ES256), donc la signature se vérifie **localement** contre le
 * JWKS mis en cache par le client. `getUser()`, lui, interroge le serveur
 * d'authentification à chaque appel — un aller-retour réseau de 0,5 à 2 s
 * mesuré sur ce projet, payé sur absolument toutes les pages et toutes les
 * Server Actions.
 *
 * La garantie de sécurité est identique : dans les deux cas un jeton forgé ou
 * altéré est rejeté. `getClaims()` rafraîchit au passage la session expirée
 * (il s'appuie sur `getSession()`), donc le seul appel réseau restant a lieu
 * une fois par période de validité du jeton, et non à chaque requête.
 *
 * Repli sur `getUser()` si la vérification locale n'est pas possible (projet
 * repassé en secret partagé HS256, JWKS injoignable) : on préfère une page
 * lente à une page qui laisse passer une identité non vérifiée.
 */
async function lireIdentiteVerifiee(): Promise<IdentiteBrute | null> {
  const supabase = createClient();

  const auth = supabase.auth as {
    getClaims?: () => Promise<{ data: { claims?: IdentiteBrute } | null; error: unknown }>;
  };

  if (typeof auth.getClaims === 'function') {
    try {
      const { data, error } = await auth.getClaims();
      if (!error && data?.claims) return data.claims;
    } catch {
      // Repli explicite ci-dessous.
    }
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return { sub: user.id, email: user.email ?? '', app_metadata: user.app_metadata as IdentiteBrute['app_metadata'] };
}

/**
 * Reads etablissement_id + role from Supabase JWT claims (app_metadata).
 * Configure a Supabase Auth Hook that injects both into app_metadata at token issue time.
 * SUPER_ADMIN may operate without an etablissementId — handled by callers.
 *
 * Mémoïsé par `cache()` sur la durée d'une requête : `requireRole()` appelle
 * ce contexte au début de *chaque* service, et une page en touche facilement
 * une demi-douzaine.
 * Le cache est par requête (React `cache`), donc jamais partagé entre deux
 * utilisateurs ni entre deux requêtes.
 */
export const getTenantContext = memoiserParRequete(async function getTenantContext(): Promise<TenantContext> {
  const identite = await lireIdentiteVerifiee();

  if (!identite?.sub) {
    throw new Error('Non authentifié');
  }

  const meta = identite.app_metadata ?? {};
  const role = meta.role;
  const etablissementId = meta.etablissement_id;

  if (!role) {
    throw new Error('Contexte tenant invalide: role manquant dans app_metadata');
  }
  if (!etablissementId && role !== 'SUPER_ADMIN') {
    throw new Error('Contexte tenant invalide: etablissement_id manquant');
  }

  return {
    userId: identite.sub,
    etablissementId: etablissementId ?? '',
    role,
    email: identite.email ?? '',
  };
});

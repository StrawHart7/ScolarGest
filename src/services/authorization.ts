import { getTenantContext, type Role, type TenantContext } from './tenant';

/**
 * Guard for Server Actions / Route Handlers: throws if the current user's role
 * isn't one of `allowedRoles`. SUPER_ADMIN always passes (platform-level access).
 *
 * Usage: `const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE');`
 */
export async function requireRole(...allowedRoles: Role[]): Promise<TenantContext> {
  const ctx = await getTenantContext();
  if (ctx.role === 'SUPER_ADMIN' || allowedRoles.includes(ctx.role)) {
    return ctx;
  }
  throw new Error(`Accès refusé: rôle ${ctx.role} non autorisé pour cette action`);
}

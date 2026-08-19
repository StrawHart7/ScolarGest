import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { evaluerAcces, ecritureAutorisee } from '@/services/abonnement-acces';

const PUBLIC_PATHS = ['/login', '/forgot-password', '/update-password', '/auth/callback'];

/**
 * Chemins qui restent accessibles même quand l'accès est bloqué : sortir de
 * l'application, consulter l'état de son abonnement, gérer son propre compte.
 * Enfermer un directeur hors de sa page d'abonnement le priverait justement
 * du moyen de régulariser.
 */
const PATHS_TOUJOURS_ACCESSIBLES = ['/abonnement', '/profil', '/auth'];

function isPublicPath(pathname: string): boolean {
  if (pathname === '/') return true;
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function estToujoursAccessible(pathname: string): boolean {
  return PATHS_TOUJOURS_ACCESSIBLES.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublicPath(pathname)) {
    const redirectUrl = new URL('/login', request.url);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  if (user && !isPublicPath(pathname)) {
    const garde = await gardeAbonnement(request, supabase, user, pathname);
    if (garde) return garde;
  }

  return response;
}

type SupabaseMiddlewareClient = ReturnType<typeof createServerClient>;

/**
 * Applique l'effet de l'abonnement (voir `abonnement-acces.ts`).
 *
 * Le middleware est le seul point de passage commun à toutes les écritures :
 * les Server Actions de Next arrivent en POST sur la route courante. Filtrer
 * ici évite d'aller ajouter une garde dans chacun des services mutateurs —
 * et surtout d'en oublier un, ce qui rendrait le verrou illusoire.
 *
 * Coût maîtrisé : la lecture de l'abonnement n'a lieu que sur les requêtes
 * non-GET (rares) et sur les navigations vers l'espace école bloqué, jamais
 * sur les assets.
 */
async function gardeAbonnement(
  request: NextRequest,
  supabase: SupabaseMiddlewareClient,
  user: { app_metadata?: Record<string, unknown> },
  pathname: string,
): Promise<NextResponse | null> {
  const meta = (user.app_metadata ?? {}) as { role?: string; etablissement_id?: string };

  // Le SUPER_ADMIN gère précisément ces abonnements : jamais restreint.
  if (meta.role === 'SUPER_ADMIN' || !meta.etablissement_id) return null;
  if (estToujoursAccessible(pathname)) return null;

  const ecriture = request.method !== 'GET' && request.method !== 'HEAD';
  if (!ecriture && !estRouteApplicative(pathname)) return null;

  const { data } = await supabase
    .from('abonnement_etablissement')
    .select('statut, "dateFin"')
    .eq('etablissementId', meta.etablissement_id)
    .order('dateFin', { ascending: false })
    .limit(1)
    .maybeSingle();

  const acces = evaluerAcces(
    (data as { statut: 'ACTIF' | 'EXPIRE' | 'SUSPENDU'; dateFin: string } | null) ?? null,
  );

  // Suspension : accès applicatif fermé, l'utilisateur est renvoyé vers la
  // page d'information d'où il peut voir quoi faire.
  if (acces.niveau === 'BLOQUE') {
    return NextResponse.redirect(new URL('/abonnement', request.url));
  }

  // Expiration : lecture seule. Les GET passent, les écritures sont refusées.
  if (ecriture && !ecritureAutorisee(acces.niveau)) {
    return new NextResponse(
      JSON.stringify({
        error:
          acces.message ??
          "Abonnement expiré : l'application est en lecture seule. Contactez ScolarGest.",
      }),
      { status: 403, headers: { 'content-type': 'application/json' } },
    );
  }

  return null;
}

/** Une page de l'espace école (par opposition aux routes techniques). */
function estRouteApplicative(pathname: string): boolean {
  return (
    pathname === '/dashboard' ||
    pathname.startsWith('/etablissement') ||
    pathname.startsWith('/utilisateurs')
  );
}

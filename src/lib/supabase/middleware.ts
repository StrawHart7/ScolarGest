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
/** Cookie de cache du verdict d'abonnement (voir `gardeAbonnement`). */
const COOKIE_ACCES = 'sg_acces';
const DUREE_CACHE_ACCES = 60;

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

  const user = await lireIdentiteVerifiee(supabase);

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
    if (garde.reponse) return garde.reponse;
    if (garde.acces) memoriserAcces(response, garde.acces);
  }

  return response;
}

type SupabaseMiddlewareClient = ReturnType<typeof createServerClient>;

interface IdentiteMiddleware {
  id: string;
  app_metadata?: Record<string, unknown>;
}

/**
 * Identité vérifiée du porteur du cookie, sans aller-retour réseau.
 *
 * Voir `services/tenant.ts` pour le raisonnement complet : le projet signe en
 * ES256, donc `getClaims()` vérifie la signature localement contre le JWKS.
 * Le middleware s'exécute sur *chaque* requête (pages, Server Actions, routes
 * API) ; y laisser un `getUser()` revenait à taxer toute l'application d'un
 * aller-retour vers le serveur d'authentification.
 *
 * `getClaims()` s'appuie sur `getSession()`, donc le rafraîchissement du jeton
 * expiré — la raison d'être de ce middleware — continue de fonctionner, et les
 * cookies rafraîchis sont réécrits par les callbacks ci-dessus.
 */
async function lireIdentiteVerifiee(
  supabase: SupabaseMiddlewareClient,
): Promise<IdentiteMiddleware | null> {
  const auth = supabase.auth as unknown as {
    getClaims?: () => Promise<{
      data: { claims?: { sub?: string; app_metadata?: Record<string, unknown> } } | null;
      error: unknown;
    }>;
  };

  if (typeof auth.getClaims === 'function') {
    try {
      const { data, error } = await auth.getClaims();
      if (!error && data?.claims?.sub) {
        return { id: data.claims.sub, app_metadata: data.claims.app_metadata };
      }
      if (!error) return null;
    } catch {
      // Repli explicite ci-dessous.
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { id: user.id, app_metadata: user.app_metadata } : null;
}

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
): Promise<{ reponse: NextResponse | null; acces: string | null }> {
  const meta = (user.app_metadata ?? {}) as { role?: string; etablissement_id?: string };

  // Le SUPER_ADMIN gère précisément ces abonnements : jamais restreint.
  if (meta.role === 'SUPER_ADMIN' || !meta.etablissement_id) return RIEN;
  if (estToujoursAccessible(pathname)) return RIEN;

  const ecriture = request.method !== 'GET' && request.method !== 'HEAD';
  if (!ecriture && !estRouteApplicative(pathname)) return RIEN;
  let aMemoriser: string | null = null;

  // Lecture : le verdict est mis en cache une minute dans un cookie httpOnly.
  // Sans cela, chaque navigation payait une requête base supplémentaire alors
  // qu'un abonnement ne change pas d'état entre deux clics. Les écritures, qui
  // sont rares et sont le vrai enjeu du verrou, relisent toujours la base.
  if (!ecriture) {
    const cache = request.cookies.get(COOKIE_ACCES)?.value;
    if (cache === 'OK' || cache === 'LECTURE_SEULE') return RIEN;
    if (cache === 'BLOQUE') {
      return { reponse: NextResponse.redirect(new URL('/abonnement', request.url)), acces: null };
    }
  }

  // L'abonnement et la fenêtre d'essai sont lus ensemble : l'essai vit sur
  // `etablissement` (voir la migration `0015`) et conditionne l'écriture au
  // même titre qu'un abonnement payé. Omettre la seconde requête ici
  // refuserait toute saisie à une école pourtant en essai — et le middleware
  // étant le verrou dur, aucun écran ne pourrait rattraper l'erreur.
  const [{ data }, { data: etab }] = await Promise.all([
    supabase
      .from('abonnement_etablissement')
      .select('statut, "dateFin"')
      .eq('etablissementId', meta.etablissement_id)
      .order('dateFin', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('etablissement')
      .select('"essaiFinLe"')
      .eq('id', meta.etablissement_id)
      .maybeSingle(),
  ]);

  const acces = evaluerAcces({
    abonnement:
      (data as { statut: 'ACTIF' | 'EXPIRE' | 'SUSPENDU'; dateFin: string } | null) ?? null,
    essaiFinLe: (etab as { essaiFinLe: string | null } | null)?.essaiFinLe ?? null,
  });

  if (!ecriture) aMemoriser = acces.niveau;

  // Suspension : accès applicatif fermé, l'utilisateur est renvoyé vers la
  // page d'information d'où il peut voir quoi faire.
  if (acces.niveau === 'BLOQUE') {
    return { reponse: NextResponse.redirect(new URL('/abonnement', request.url)), acces: null };
  }

  // Expiration : lecture seule. Les GET passent, les écritures sont refusées.
  if (ecriture && !ecritureAutorisee(acces.niveau)) {
    return { reponse: new NextResponse(
      JSON.stringify({
        error:
          acces.message ??
          "Abonnement expiré : l'application est en lecture seule. Contactez ScolarGest.",
      }),
      { status: 403, headers: { 'content-type': 'application/json' } },
    ), acces: null };
  }

  return { reponse: null, acces: aMemoriser };
}

const RIEN = { reponse: null, acces: null } as const;

/** Une page de l'espace école (par opposition aux routes techniques). */
function estRouteApplicative(pathname: string): boolean {
  return (
    pathname === '/dashboard' ||
    pathname.startsWith('/etablissement') ||
    pathname.startsWith('/utilisateurs')
  );
}

/**
 * Le cookie doit être posé sur la *réponse* pour atteindre le navigateur :
 * `request.cookies.set` ne ferait que réécrire l'en-tête entrant côté serveur.
 */
function memoriserAcces(response: NextResponse, niveau: string): void {
  response.cookies.set({
    name: COOKIE_ACCES,
    value: niveau,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: DUREE_CACHE_ACCES,
  });
}

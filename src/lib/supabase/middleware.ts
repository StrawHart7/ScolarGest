import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { evaluerAcces, ecritureAutorisee } from '@/services/abonnement-acces';
import { reessayerLecture } from '@/lib/reessayer';

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

const CHEMIN_MOT_DE_PASSE = '/profil/mot-de-passe';

/**
 * Nom du marqueur posé dans `app_metadata` à la création d'un compte par
 * identifiant, et à chaque réinitialisation par le directeur.
 *
 * Répété ici plutôt qu'importé de `services/utilisateur` : ce module tourne
 * dans le middleware, sur **chaque** requête. Y faire entrer le graphe des
 * services tirerait `next/headers` et la moitié du domaine dans le runtime
 * edge. Un test garde les deux constantes d'accord.
 */
export const CLAIM_MOT_DE_PASSE_PROVISOIRE = 'mot_de_passe_provisoire';

/**
 * Un mot de passe tiré par la plateforme a circulé sur un bout de papier :
 * tant qu'il n'est pas remplacé, l'application reste fermée.
 *
 * Ce n'est pas une barrière de sécurité — c'en serait une mauvaise, un
 * middleware n'étant pas le dernier mot. C'est ce qui garantit qu'un
 * enseignant finit par avoir un mot de passe **qu'il a choisi**, donc qu'il
 * retient, au lieu de garder à vie celui du papier.
 *
 * Trois chemins restent ouverts, et chacun pour une raison :
 * l'écran de changement lui-même, tout ce qui touche à l'authentification, et
 * les chemins publics — sans quoi la déconnexion elle-même serait prise au
 * piège, et on enfermerait quelqu'un dans un écran qu'il refuse de remplir.
 */
function doitChangerMotDePasse(
  user: { app_metadata?: Record<string, unknown> },
  pathname: string,
): boolean {
  if (!user.app_metadata?.[CLAIM_MOT_DE_PASSE_PROVISOIRE]) return false;
  if (pathname === CHEMIN_MOT_DE_PASSE || pathname.startsWith(`${CHEMIN_MOT_DE_PASSE}/`)) {
    return false;
  }
  if (isPublicPath(pathname)) return false;
  return true;
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

  // Une session encore présente renvoie vers le tableau de bord — sauf quand
  // `/login` porte un motif. Sans cette exception, un utilisateur renvoyé ici
  // *parce que* sa session est périmée serait immédiatement rebouclé vers
  // `/dashboard`, et n'aurait aucun moyen de se reconnecter. C'est un
  // deuxième garde-fou : l'effacement des cookies suffit en principe, mais
  // une boucle de redirection est le pire qui puisse arriver à cet endroit.
  if (user && pathname === '/login' && !request.nextUrl.searchParams.get('error')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  if (user && doitChangerMotDePasse(user, pathname)) {
    return NextResponse.redirect(new URL(CHEMIN_MOT_DE_PASSE, request.url));
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
    // Seule la suspension change la destination d'une lecture ; tous les
    // autres niveaux la laissent passer, y compris AVANT_ESSAI et
    // LECTURE_SEULE — c'est le principe : on ne prend pas les données de
    // l'école en otage.
    if (cache && cache !== 'BLOQUE') return RIEN;
    if (cache === 'BLOQUE') {
      return { reponse: NextResponse.redirect(new URL('/abonnement', request.url)), acces: null };
    }
  }

  // L'abonnement et la fenêtre d'essai sont lus ensemble : l'essai vit sur
  // `etablissement` (voir la migration `0015`) et conditionne l'écriture au
  // même titre qu'un abonnement payé. Omettre la seconde requête ici
  // refuserait toute saisie à une école pourtant en essai — et le middleware
  // étant le verrou dur, aucun écran ne pourrait rattraper l'erreur.
  const [abonnementLu, etabLu] = await Promise.all([
    reessayerLecture(async () =>
      supabase
        .from('abonnement_etablissement')
        .select('statut, "dateFin"')
        .eq('etablissementId', meta.etablissement_id)
        .order('dateFin', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ),
    reessayerLecture(async () =>
      supabase
        .from('etablissement')
        .select('"essaiDebuteLe", "essaiFinLe", "suspenduLe", "motifSuspension"')
        .eq('id', meta.etablissement_id)
        .maybeSingle(),
    ),
  ]);

  // **Si la lecture échoue, on laisse passer sans rien conclure.**
  //
  // Ces deux requêtes rendaient `null` en silence quand la base répondait 504
  // — une à quatre fois par heure d'après les journaux, à toute heure. Une
  // école payante était alors évaluée comme n'ayant ni abonnement ni essai,
  // c'est-à-dire comme une école neuve. Le verrou ne plantait pas : il se
  // trompait.
  //
  // Entre les deux erreurs possibles, le choix n'est pas symétrique. Fermer
  // enfermerait dehors une école à jour de ses paiements à cause d'un à-coup
  // d'infrastructure. Laisser passer donne au pire une requête de grâce à une
  // école bloquée — et ce verrou est une **barrière de facturation**, pas une
  // barrière d'authentification : l'identité reste vérifiée par Supabase Auth,
  // et les données restent protégées par la RLS.
  //
  // On ne mémorise rien dans le cookie de cache : la prochaine requête
  // retentera. Un verdict faux mis en cache durerait une minute.
  if (abonnementLu.error || etabLu.error) return RIEN;

  // **Une session valide qui désigne un établissement disparu.**
  //
  // `etabLu.error` est nul et `etabLu.data` l'est aussi : la lecture a abouti
  // et n'a trouvé personne. L'école n'existe plus, la session pointe dans le
  // vide.
  //
  // Rien ne le signalait. `lireIdentiteVerifiee` s'appuie sur `getClaims()`,
  // qui vérifie la signature du jeton **hors ligne** contre le JWKS : ni le
  // compte supprimé, ni l'établissement effacé ne sont vus, et le jeton reste
  // accepté jusqu'à son expiration — une heure. Pendant cette heure, les
  // lectures rendaient des listes vides et les écritures tombaient en violation
  // de clé étrangère (`23503`), donc en page d'erreur avec une référence qui
  // n'explique rien. Constaté le 2026-09-16, sur téléphone, après la remise à
  // zéro d'une école de test.
  //
  // Le piège se referme au-dessus : `/login` renvoie vers `/dashboard` tant
  // qu'une session existe. L'utilisateur ne pouvait donc pas se reconnecter —
  // la seule porte de sortie était celle que le middleware fermait.
  //
  // On préfère **effacer la session** plutôt que laisser passer : ici la
  // dissymétrie s'inverse par rapport au repli plus haut. Laisser passer ne
  // donne aucune requête de grâce, seulement une heure d'erreurs muettes.
  if (etabLu.data === null) {
    const destination = new URL('/login', request.url);
    destination.searchParams.set('error', 'etablissement_introuvable');
    const sortie = NextResponse.redirect(destination);
    // Les cookies de session sont retirés sur la réponse de redirection
    // elle-même : `signOut()` écrirait sur `response`, que l'on n'renvoie pas
    // dans cette branche. Sans cela, la requête suivante reporterait le même
    // jeton et l'on tournerait en rond.
    for (const cookie of request.cookies.getAll()) {
      if (cookie.name.startsWith('sb-')) sortie.cookies.delete(cookie.name);
    }
    sortie.cookies.delete(COOKIE_ACCES);
    return { reponse: sortie, acces: null };
  }

  const data = abonnementLu.data;
  const etab = etabLu.data;

  const ligneEtab = etab as {
    essaiDebuteLe: string | null;
    essaiFinLe: string | null;
    suspenduLe: string | null;
    motifSuspension: string | null;
  } | null;

  const acces = evaluerAcces({
    abonnement:
      (data as { statut: 'ACTIF' | 'EXPIRE' | 'SUSPENDU'; dateFin: string } | null) ?? null,
    essaiFinLe: ligneEtab?.essaiFinLe ?? null,
    essaiDebuteLe: ligneEtab?.essaiDebuteLe ?? null,
    suspension: ligneEtab?.suspenduLe
      ? { le: ligneEtab.suspenduLe, motif: ligneEtab.motifSuspension ?? 'Motif non précisé.' }
      : null,
  });

  // Sortie du blocage circulaire de l'essai.
  //
  // L'essai démarre à la définition du code de confirmation, première étape de
  // `/demarrage`. Mais c'est une écriture, et une école sans essai ni
  // abonnement se la voyait refuser ici même : l'essai ne pouvait donc jamais
  // démarrer, et toute école neuve naissait en lecture seule. C'est exactement
  // pourquoi `seed-onboarding-test.ts` doit fabriquer un abonnement ACTIF.
  //
  // L'exception est **conditionnelle**, et pas une entrée de plus dans
  // `PATHS_TOUJOURS_ACCESSIBLES` : ouvrir `/demarrage` en grand laisserait une
  // école expirée continuer d'y créer cycles, années et classes. Elle se
  // referme d'elle-même à la seconde où le code est posé, puisque l'essai
  // démarre alors.
  // Mêmes deux conditions que le niveau AVANT_ESSAI : aucune trace d'essai, ni
  // début ni fin. Ne tester que le début rouvrirait /demarrage en écriture à
  // une école dont l'essai est échu.
  const enConfiguration = !ligneEtab?.essaiDebuteLe && !ligneEtab?.essaiFinLe && !data;
  if (
    ecriture &&
    enConfiguration &&
    !acces.motifSuspension &&
    (pathname === '/demarrage' || pathname.startsWith('/demarrage/'))
  ) {
    return RIEN;
  }

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

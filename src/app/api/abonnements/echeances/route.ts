import { NextResponse, type NextRequest } from 'next/server';
import { traiterEcheances } from '@/services/relances-abonnement';

/**
 * Balayage quotidien des échéances d'abonnement et d'essai.
 *
 * **Cette route doit être exclue du `matcher` de `src/middleware.ts`.** Sans
 * cela, le planificateur reçoit une redirection 307 vers `/login`, la compte
 * comme une livraison réussie, et aucune relance ne part — sans la moindre
 * erreur nulle part. C'est exactement la panne qu'a connue le webhook FedaPay,
 * et c'est la plus silencieuse de toutes.
 *
 * **Authentification par secret partagé.** Il n'y a pas de session : l'appelant
 * est un planificateur. `CRON_SECRET` est comparé en en-tête ; sans lui, la
 * route est ouverte à qui connaît son adresse, et déclencher des envois de
 * courriels à volonté est un moyen commode de brûler un domaine d'expédition.
 *
 * Vercel Cron émet un GET et fournit lui-même l'en-tête
 * `authorization: Bearer <CRON_SECRET>`.
 */

// Le balayage lit et écrit : aucune mise en cache ne doit s'y appliquer.
export const dynamic = 'force-dynamic';

function autorise(request: NextRequest): boolean {
  const attendu = process.env.CRON_SECRET;
  // Pas de secret configuré : on refuse plutôt que d'ouvrir. Un déploiement
  // incomplet doit se voir, pas se comporter comme un déploiement ouvert.
  if (!attendu) return false;
  const entete = request.headers.get('authorization') ?? '';
  return entete === `Bearer ${attendu}`;
}

export async function GET(request: NextRequest) {
  if (!autorise(request)) {
    return NextResponse.json({ erreur: 'Non autorisé.' }, { status: 401 });
  }

  try {
    const bilan = await traiterEcheances();
    return NextResponse.json(bilan);
  } catch (e) {
    // Les erreurs Supabase ne sont pas des `Error` : un test `instanceof`
    // masquerait la cause réelle derrière un message générique.
    const raison =
      e instanceof Error
        ? e.message
        : typeof e === 'object' && e !== null
          ? JSON.stringify(e)
          : String(e);
    return NextResponse.json({ erreur: raison }, { status: 500 });
  }
}

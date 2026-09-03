import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  /**
   * Tout ce qui n'est pas nié ici passe par la garde d'authentification, et
   * finit donc redirigé vers `/login` pour un visiteur non connecté. Toute
   * nouvelle ressource publique servie hors `/_next` doit être ajoutée.
   *
   * `api/fedapay` en particulier : le webhook arrive depuis les serveurs de
   * FedaPay, sans cookie ni session. Sans cette exclusion, il recevrait un 307
   * vers la page de connexion, que FedaPay compterait comme une livraison
   * réussie — et aucun abonnement ne serait jamais activé, sans qu'aucune
   * erreur n'apparaisse nulle part.
   *
   * `api/abonnements` porte le balayage quotidien des echeances, appele par
   * un planificateur sans cookie : meme raisonnement, meme panne silencieuse
   * si on l'oublie.
   */
  matcher: [
    '/((?!api/fedapay|api/abonnements|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest)$).*)',
  ],
};

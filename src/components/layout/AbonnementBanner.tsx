import Link from 'next/link';
import { AlertTriangle, Lock } from 'lucide-react';
import { getAccesAbonnementCourant } from '@/services/abonnement';

/**
 * Bandeau d'état de l'abonnement, affiché sur toutes les pages de l'espace
 * école. Volontairement placé dans le layout plutôt que sur une page dédiée :
 * une école en lecture seule doit le comprendre au premier écran, pas après
 * avoir cherché pourquoi un bouton ne répond plus.
 *
 * Ne rend rien quand tout va bien, et n'échoue jamais bruyamment : si la
 * lecture de l'abonnement casse, l'application reste utilisable — un bandeau
 * manquant est moins grave qu'une application inaccessible.
 */
export async function AbonnementBanner() {
  let acces;
  try {
    acces = await getAccesAbonnementCourant();
  } catch {
    return null;
  }

  if (acces.niveau === 'OK' || !acces.message) return null;

  const bloquant = acces.niveau === 'LECTURE_SEULE' || acces.niveau === 'BLOQUE';

  return (
    <div
      role="status"
      className={`flex flex-wrap items-center gap-3 border-b px-container-pad py-3 ${
        bloquant ? 'border-error/20 bg-error/5' : 'border-amber-500/20 bg-amber-500/5'
      }`}
    >
      {bloquant ? (
        <Lock className="h-5 w-5 shrink-0 text-error" aria-hidden />
      ) : (
        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-700" aria-hidden />
      )}
      <p className={`text-body-sm ${bloquant ? 'text-error' : 'text-amber-700'}`}>
        {acces.message}
      </p>
      <Link href="/abonnement" className="text-body-sm font-medium text-primary hover:underline">
        Voir mon abonnement
      </Link>
    </div>
  );
}

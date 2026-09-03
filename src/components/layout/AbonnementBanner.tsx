import Link from 'next/link';
import { AlertTriangle, Lock, Sparkles } from 'lucide-react';
import { getAccesAbonnementCourant } from '@/services/abonnement';
import { getTenantContext } from '@/services/tenant';

/**
 * Bandeau d'état de l'abonnement, affiché sur toutes les pages de l'espace
 * école. Volontairement placé dans le layout plutôt que sur une page dédiée :
 * une école en lecture seule doit le comprendre au premier écran, pas après
 * avoir cherché pourquoi un bouton ne répond plus.
 *
 * C'est aussi le **seul chemin visible vers le paiement**. La page de
 * souscription est sinon enfouie dans Établissement → Abonnement, et le
 * Comptable — qui a pourtant le droit de souscrire — n'a même pas cette entrée
 * dans sa barre latérale. Un paywall qu'il faut chercher ne convertit pas.
 *
 * Ne rend rien quand tout va bien, et n'échoue jamais bruyamment : si la
 * lecture de l'abonnement casse, l'application reste utilisable — un bandeau
 * manquant est moins grave qu'une application inaccessible.
 */
export async function AbonnementBanner() {
  let acces;
  let role: string | null = null;
  try {
    acces = await getAccesAbonnementCourant();
    role = (await getTenantContext()).role;
  } catch {
    return null;
  }

  if (acces.niveau === 'OK' || !acces.message) return null;

  const bloquant = acces.niveau === 'LECTURE_SEULE' || acces.niveau === 'BLOQUE';
  // Un essai qui touche à sa fin n'est plus une information neutre : à une
  // semaine de la lecture seule, le ton passe de l'accueil à l'avertissement.
  // Garder le ton bleu jusqu'au dernier jour laisserait une école découvrir la
  // coupure sans l'avoir vue venir.
  const essaiFinissant =
    acces.niveau === 'ESSAI' && acces.joursRestants !== null && acces.joursRestants <= 7;
  const essai = acces.niveau === 'ESSAI' && !essaiFinissant;
  const configuration = acces.niveau === 'AVANT_ESSAI';

  // Un décompte d'essai n'est pas une alerte : le teindre en ambre comme une
  // échéance manquée mettrait sous tension une école qui n'a encore rien à se
  // reprocher. Trois tons, pour trois situations distinctes.
  const ton = bloquant
    ? { cadre: 'border-error/20 bg-error/5', texte: 'text-error' }
    : essai || configuration
      ? { cadre: 'border-primary-container/20 bg-primary-fixed/40', texte: 'text-primary-container' }
      : { cadre: 'border-amber-500/20 bg-amber-500/5', texte: 'text-amber-700' };

  // Souscrire engage une dépense : même périmètre que la page elle-même.
  const peutPayer = role === 'DIRECTEUR' || role === 'COMPTABLE';

  return (
    <div
      role="status"
      className={`flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-container-pad py-3 ${ton.cadre}`}
    >
      {bloquant ? (
        <Lock className="h-5 w-5 shrink-0 text-error" aria-hidden />
      ) : essai || configuration ? (
        <Sparkles className="h-5 w-5 shrink-0 text-primary-container" aria-hidden />
      ) : (
        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-700" aria-hidden />
      )}

      <p className={`text-body-sm ${ton.texte}`}>{acces.message}</p>

      <div className="ml-auto flex flex-wrap items-center gap-4">
        {/* Une école en cours de configuration n'a rien à payer : lui proposer
            de souscrire au milieu de son paramétrage serait hors sujet. */}
        {configuration ? (
          <Link
            href="/demarrage"
            className="rounded-lg bg-primary-container px-3 py-1.5 text-body-sm font-medium text-white transition-colors hover:bg-primary"
          >
            Reprendre la configuration
          </Link>
        ) : (
          peutPayer && (
          <Link
            href="/abonnement/souscrire"
            className="rounded-lg bg-primary-container px-3 py-1.5 text-body-sm font-medium text-white transition-colors hover:bg-primary"
          >
            {bloquant ? 'Réactiver mon accès' : 'Souscrire maintenant'}
          </Link>
          )
        )}
        {!configuration && (
          <Link
            href="/abonnement"
            className="text-body-sm font-medium text-primary hover:underline"
          >
            Voir mon abonnement
          </Link>
        )}
      </div>
    </div>
  );
}

import Link from 'next/link';
import { Bell } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { listNotesEnAttente, listEvaluationsSoumises } from '@/services/note';

/**
 * Cloche de notifications, avec un badge de compte quand quelque chose
 * attend une décision. Avant ce composant, la cloche était un lien statique
 * sans aucun signal : une demande de correction de note soumise par un
 * enseignant n'était visible qu'en ouvrant `/profil/notifications` (ou
 * `/etablissement/notes/approbation`) de sa propre initiative — la
 * Secrétaire « ne recevait rien ». Le flux d'approbation existait déjà
 * (`listNotesEnAttente`), il manquait seulement ce signal dans l'en-tête.
 *
 * Ne rend jamais rien de bloquant : si le calcul du compte échoue, la cloche
 * s'affiche quand même, simplement sans badge (même logique défensive que
 * `AbonnementBanner`).
 */
export async function NotificationsBell() {
  let count = 0;
  try {
    const ctx = await getTenantContext();
    if (ctx.role === 'SECRETAIRE') {
      const [correctionsEnAttente, soumissionsEnAttente] = await Promise.all([
        listNotesEnAttente(),
        listEvaluationsSoumises(),
      ]);
      count = correctionsEnAttente.length + soumissionsEnAttente.length;
    }
  } catch {
    count = 0;
  }

  return (
    <Link
      href="/profil/notifications"
      title="Notifications"
      aria-label={count > 0 ? `Notifications, ${count} en attente` : 'Notifications'}
      className="relative grid h-10 w-10 place-items-center rounded-full text-primary-container transition-colors hover:bg-surface-container-high active:bg-surface-container-high md:h-9 md:w-9 md:rounded md:text-text-secondary md:hover:text-text-primary"
    >
      <Bell className="h-[20px] w-[20px] md:h-[18px] md:w-[18px]" aria-hidden />
      {count > 0 && (
        <span
          className="absolute right-2 top-2 h-2 w-2 rounded-full bg-error md:right-1.5 md:top-1.5"
          aria-hidden
        />
      )}
    </Link>
  );
}

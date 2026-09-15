import Link from 'next/link';
import { Bell } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { listNotesEnAttente, listEvaluationsSoumises } from '@/services/note';
import { notificationsEnseignant } from '@/services/notifications';

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
    // Le DIRECTEUR y est entré le 2026-09-15, et il aurait dû y être depuis le
    // début : `/profil/notifications` lui montrait bien ses soumissions en
    // attente, mais la cloche ne comptait que pour la SECRÉTAIRE. Il n'avait
    // donc **jamais** de pastille, et dans une école sans secrétariat —
    // le cas courant — personne n'était jamais averti qu'une évaluation
    // attendait une décision. Le signal manquait, pas la donnée.
    if (ctx.role === 'DIRECTEUR' || ctx.role === 'SECRETAIRE') {
      const [correctionsEnAttente, soumissionsEnAttente] = await Promise.all([
        listNotesEnAttente(),
        listEvaluationsSoumises(),
      ]);
      count = correctionsEnAttente.length + soumissionsEnAttente.length;
    } else if (ctx.role === 'ENSEIGNANT') {
      // L'enseignant n'avait aucune notification : il soumettait ses notes et
      // n'apprenait jamais qu'elles avaient été validées, ni surtout qu'elles
      // lui avaient été renvoyées.
      count = (await notificationsEnseignant()).length;
    }
  } catch {
    count = 0;
  }

  return (
    <Link
      href="/profil/notifications"
      title="Notifications"
      aria-label={count > 0 ? `Notifications, ${count} en attente` : 'Notifications'}
      className="relative grid h-row-standard w-row-standard place-items-center rounded-full text-primary-container transition-colors hover:bg-surface-container-high active:bg-surface-container-high md:h-9 md:w-9 md:rounded md:text-text-secondary md:hover:text-text-primary"
    >
      <Bell className="h-[20px] w-[20px] md:h-[18px] md:w-[18px]" aria-hidden />
      {count > 0 && (
        // Une pastille de 8px ne se voit pas. Elle porte désormais le nombre,
        // et un liseré de la couleur de l'en-tête la détache du fond — c'est
        // le seul endroit de l'application qui dise « quelque chose vous
        // attend » sans qu'on ait eu l'idée d'aller voir.
        <span
          className="absolute right-1 top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-error px-1 text-[11px] font-bold leading-none text-white ring-2 ring-surface-container-lowest md:right-0 md:top-0"
          aria-hidden
        >
          {count > 9 ? '9+' : count}
        </span>
      )}
    </Link>
  );
}

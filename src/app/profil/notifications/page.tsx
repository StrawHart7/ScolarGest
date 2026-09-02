import Link from 'next/link';
import { BellOff, ClipboardCheck, CreditCard } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { listNotesEnAttente, listEvaluationsSoumises } from '@/services/note';
import { getAccesAbonnementCourant } from '@/services/abonnement';
import { JOURS_AVERTISSEMENT } from '@/services/abonnement-acces';
import { AppLayout } from '@/components/layout/AppLayout';
import { LienRetour } from '@/components/layout/LienRetour';
import { getSidebarItems } from '@/lib/navigation';

interface Notification {
  titre: string;
  detail: string;
  href: string;
  icone: 'approbation' | 'abonnement';
  urgence: 'info' | 'avertissement';
}

/**
 * Il n'existe pas de système de notifications persistées : cette page dérive
 * les alertes de l'état réel de l'établissement, plutôt que d'afficher une
 * boîte de réception vide qui donnerait l'illusion d'une fonctionnalité.
 */
export default async function NotificationsPage() {
  const ctx = await getTenantContext();
  const notifications: Notification[] = [];

  if (ctx.role === 'SECRETAIRE') {
    const [soumissions, corrections] = await Promise.all([
      listEvaluationsSoumises(),
      listNotesEnAttente(),
    ]);
    if (soumissions.length > 0) {
      const nombreNotes = soumissions.reduce((total, s) => total + s.nombreNotes, 0);
      notifications.push({
        titre: `${soumissions.length} évaluation(s) à valider (${nombreNotes} note(s))`,
        detail: 'Des enseignants ont soumis des notes qui attendent votre validation.',
        href: '/etablissement/notes/approbation',
        icone: 'approbation',
        urgence: 'avertissement',
      });
    }
    if (corrections.length > 0) {
      notifications.push({
        titre: `${corrections.length} demande(s) de correction de notes`,
        detail: 'Des enseignants attendent votre décision sur des corrections de notes déjà validées.',
        href: '/etablissement/notes/approbation',
        icone: 'approbation',
        urgence: 'avertissement',
      });
    }
  }

  if (ctx.role === 'DIRECTEUR') {
    const acces = await getAccesAbonnementCourant();
    if (acces.niveau !== 'OK' && acces.message) {
      notifications.push({
        titre: 'Abonnement à renouveler',
        detail: acces.message,
        href: '/abonnement',
        icone: 'abonnement',
        urgence: 'avertissement',
      });
    }
  }

  return (
    <AppLayout
      items={getSidebarItems(ctx.role)}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="mx-auto max-w-2xl space-y-6">
        <LienRetour href="/profil">Retour au profil</LienRetour>

        <div>
          <h1 className="text-display-sm text-text-primary">Notifications</h1>
          <p className="text-body-sm text-text-secondary">
            Points d&apos;attention en cours pour votre rôle. Les alertes d&apos;abonnement
            apparaissent {JOURS_AVERTISSEMENT} jours avant l&apos;échéance.
          </p>
        </div>

        {notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-surface-border bg-surface-container-lowest py-16 text-center">
            <BellOff className="h-10 w-10 text-text-secondary/50" aria-hidden />
            <p className="text-body-md text-text-primary">Rien ne requiert votre attention.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {notifications.map((notification) => (
              <li key={notification.href}>
                <Link
                  href={notification.href}
                  className="flex items-start gap-3 rounded-lg border border-surface-border bg-surface-container-lowest p-4 transition-colors hover:border-primary-container/60 hover:bg-primary-fixed/30"
                >
                  <span
                    className={
                      notification.urgence === 'avertissement'
                        ? 'grid h-9 w-9 shrink-0 place-items-center rounded-full bg-error-container text-error-on-container'
                        : 'grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary-fixed text-primary-container'
                    }
                  >
                    {notification.icone === 'approbation' ? (
                      <ClipboardCheck className="h-[18px] w-[18px]" aria-hidden />
                    ) : (
                      <CreditCard className="h-[18px] w-[18px]" aria-hidden />
                    )}
                  </span>
                  <span>
                    <span className="block text-body-md font-medium text-text-primary">
                      {notification.titre}
                    </span>
                    <span className="block text-body-sm text-text-secondary">
                      {notification.detail}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppLayout>
  );
}

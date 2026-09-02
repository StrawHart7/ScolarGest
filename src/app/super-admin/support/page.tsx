import { getTenantContext } from '@/services/tenant';
import { listDemandesSupport } from '@/services/support';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { getSidebarItems } from '@/lib/navigation';
import { FileSupport } from './FileSupport';

export const metadata = { title: 'Support' };

/**
 * File de support de la plateforme.
 *
 * La page ne fait que charger et cadrer : compteurs, filtres et tri vivent
 * dans `FileSupport`, parce que les cartes du haut **sont** le filtre. Les
 * calculer ici obligerait à les envoyer au client pour qu'il les rende
 * cliquables, et à maintenir deux fois la même règle de comptage.
 *
 * La console **compte et répond, elle ne consulte pas** : rien ici ne lit la
 * donnée d'une école. Ce qui s'affiche est ce que l'école a elle-même écrit.
 */
export default async function SupportPlateformePage() {
  const ctx = await getTenantContext();
  const demandes = await listDemandesSupport();

  const aTraiter = demandes.filter((d) => d.statut === 'NOUVELLE').length;

  return (
    <AppLayout
      items={getSidebarItems('SUPER_ADMIN')}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader
          title="Support"
          description={
            aTraiter > 0
              ? `${aTraiter} demande${aTraiter > 1 ? 's' : ''} sans réponse sur ${demandes.length}.`
              : `${demandes.length} demande${demandes.length > 1 ? 's' : ''}, aucune en attente.`
          }
        />

        <FileSupport demandes={demandes} />
      </div>
    </AppLayout>
  );
}

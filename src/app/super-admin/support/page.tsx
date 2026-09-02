import { getTenantContext } from '@/services/tenant';
import { listDemandesSupport } from '@/services/support';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { getSidebarItems } from '@/lib/navigation';
import { CarteDemandeSupport } from './CarteDemandeSupport';

export const metadata = { title: 'Support' };

/**
 * File des demandes de support, toutes écoles confondues.
 *
 * Même structure que les demandes de démo : les demandes sans réponse sont
 * regroupées en tête, indépendamment de leur date. Ce sont les seules sur
 * lesquelles il y a quelque chose à faire, et les noyer dans l'ordre
 * chronologique reviendrait à reconstruire le problème qu'on corrige.
 *
 * La console **compte et répond, elle ne consulte pas** : rien ici ne lit la
 * donnée d'une école. Ce qui s'affiche est ce que l'école a elle-même écrit.
 */
export default async function SupportPlateformePage() {
  const ctx = await getTenantContext();
  const demandes = await listDemandesSupport();

  const aTraiter = demandes.filter((d) => d.statut === 'NOUVELLE');
  const enCours = demandes.filter((d) => d.statut === 'EN_COURS');
  const closes = demandes.filter((d) => d.statut === 'RESOLUE' || d.statut === 'FERMEE');

  const sections = [
    { titre: 'À traiter', aide: 'Personne ne les a encore prises en charge.', liste: aTraiter },
    { titre: 'En cours', aide: 'Prises en charge, pas encore closes.', liste: enCours },
    { titre: 'Closes', aide: 'Résolues ou fermées.', liste: closes },
  ];

  return (
    <AppLayout
      items={getSidebarItems('SUPER_ADMIN')}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="mx-auto max-w-4xl space-y-6">
        <PageHeader
          title="Support"
          description={
            aTraiter.length > 0
              ? `${aTraiter.length} demande${aTraiter.length > 1 ? 's' : ''} sans réponse sur ${demandes.length}.`
              : `${demandes.length} demande${demandes.length > 1 ? 's' : ''}, aucune en attente.`
          }
        />

        {demandes.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <p className="text-body-md text-text-primary">Aucune demande pour le moment.</p>
              <p className="mt-1 text-body-sm text-text-secondary">
                Les demandes envoyées depuis la page Support des établissements apparaîtront ici.
              </p>
            </CardContent>
          </Card>
        ) : (
          sections
            .filter((s) => s.liste.length > 0)
            .map((section) => (
              <section key={section.titre} className="space-y-3">
                <div>
                  <h2 className="text-body-md font-semibold text-text-primary">
                    {section.titre}
                    <span className="ml-2 text-body-sm font-normal text-text-secondary">
                      {section.liste.length}
                    </span>
                  </h2>
                  <p className="text-body-sm text-text-secondary">{section.aide}</p>
                </div>
                <div className="flex flex-col gap-3">
                  {section.liste.map((demande) => (
                    <CarteDemandeSupport key={demande.id} demande={demande} />
                  ))}
                </div>
              </section>
            ))
        )}
      </div>
    </AppLayout>
  );
}

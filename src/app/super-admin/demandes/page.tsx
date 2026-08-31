import { getTenantContext } from '@/services/tenant';
import { listDemandesDemo } from '@/services/demande-demo';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { getSidebarItems } from '@/lib/navigation';
import { CarteDemande } from './CarteDemande';

export const metadata = { title: 'Demandes de démo' };

/**
 * File des prospects venus du formulaire public.
 *
 * Cet écran n'existait pas : la table `demande_demo` était alimentée depuis la
 * page d'accueil et lue nulle part. Chaque demande — le seul appel à l'action
 * de tout le site public — arrivait dans une table que personne n'ouvrait.
 *
 * Les demandes sans réponse sont regroupées en tête, indépendamment de leur
 * date : ce sont les seules sur lesquelles il y a quelque chose à faire, et
 * les noyer dans l'ordre chronologique reviendrait à reconstruire le problème
 * qu'on corrige.
 */
export default async function DemandesPage() {
  const ctx = await getTenantContext();
  const demandes = await listDemandesDemo();

  const aTraiter = demandes.filter((d) => d.statut === 'NOUVELLE');
  const enCours = demandes.filter((d) => d.statut === 'CONTACTEE');
  const closes = demandes.filter(
    (d) => d.statut === 'CONVERTIE' || d.statut === 'REJETEE',
  );

  const converties = demandes.filter((d) => d.statut === 'CONVERTIE').length;
  const traitees = demandes.length - aTraiter.length;
  const tauxConversion = traitees > 0 ? Math.round((converties / traitees) * 100) : null;

  const sections: { titre: string; aide: string; liste: typeof demandes }[] = [
    {
      titre: 'À traiter',
      aide: 'Personne ne leur a encore répondu.',
      liste: aTraiter,
    },
    {
      titre: 'En cours',
      aide: 'Contactées, en attente de décision.',
      liste: enCours,
    },
    {
      titre: 'Closes',
      aide: 'Converties ou écartées.',
      liste: closes,
    },
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
          title="Demandes de démo"
          description={
            tauxConversion !== null
              ? `${demandes.length} demande${demandes.length > 1 ? 's' : ''} reçue${demandes.length > 1 ? 's' : ''}, ${tauxConversion} % de conversion sur celles traitées.`
              : `${demandes.length} demande${demandes.length > 1 ? 's' : ''} reçue${demandes.length > 1 ? 's' : ''}.`
          }
        />

        {demandes.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <p className="text-body-md text-text-primary">Aucune demande pour le moment.</p>
              <p className="mt-1 text-body-sm text-text-secondary">
                Les demandes envoyées depuis le formulaire de la page d&apos;accueil
                apparaîtront ici.
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
                    <CarteDemande key={demande.id} demande={demande} />
                  ))}
                </div>
              </section>
            ))
        )}
      </div>
    </AppLayout>
  );
}

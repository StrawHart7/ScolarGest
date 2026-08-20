import { getTenantContext } from '@/services/tenant';
import { peutEcrire } from '@/services/abonnement';
import { listAnneesScolaires } from '@/services/annee-scolaire';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getSidebarItems } from '@/lib/navigation';
import { ImportPaiementsForm } from './ImportForm';

export default async function ImportPaiementsPage() {
  const ctx = await getTenantContext();
  const canWrite =
    (ctx.role === 'COMPTABLE' || ctx.role === 'SUPER_ADMIN') && (await peutEcrire());
  const annees = await listAnneesScolaires();
  const anneeActive = annees.find((a) => a.statut === 'ACTIVE');

  return (
    <AppLayout
      items={getSidebarItems(ctx.role)}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-display-sm text-text-primary">
            Import Excel — historique financier
          </h1>
          <p className="text-body-sm text-text-secondary">
            {anneeActive ? `Année cible : ${anneeActive.libelle}` : 'Aucune année active'}
          </p>
        </div>

        {!canWrite ? (
          <Card>
            <CardContent className="p-6">
              <p className="text-body-sm text-text-secondary">
                L&apos;import de versements est réservé au Comptable et au Directeur.
              </p>
            </CardContent>
          </Card>
        ) : !anneeActive ? (
          <Card>
            <CardContent className="p-6">
              <p className="text-body-sm text-error">
                Activez une année scolaire avant d&apos;importer.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Fichier à importer</CardTitle>
            </CardHeader>
            <CardContent>
              <ImportPaiementsForm anneeScolaireId={anneeActive.id} />
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

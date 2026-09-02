import { getTenantContext } from '@/services/tenant';
import { listAnneesScolaires } from '@/services/annee-scolaire';
import { AppLayout } from '@/components/layout/AppLayout';
import { LienRetour } from '@/components/layout/LienRetour';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getSidebarItems } from '@/lib/navigation';
import { ImportForm } from './ImportForm';

export default async function ImportEnseignantsPage() {
  const ctx = await getTenantContext();
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
        <LienRetour href="/etablissement/enseignants">Retour aux enseignants</LienRetour>

        <div>
          <h1 className="text-display-sm text-text-primary">Import Excel — enseignants &amp; affectations</h1>
          <p className="text-body-sm text-text-secondary">
            {anneeActive ? `Année cible : ${anneeActive.libelle}` : 'Aucune année active'}
          </p>
        </div>

        {!anneeActive ? (
          <Card>
            <CardContent className="p-6">
              <p className="text-body-sm text-error">Activez une année scolaire avant d&apos;importer.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Fichier à importer</CardTitle>
            </CardHeader>
            <CardContent>
              <ImportForm anneeScolaireId={anneeActive.id} />
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

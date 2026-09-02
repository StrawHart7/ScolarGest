import { getTenantContext } from '@/services/tenant';
import { listAnneesScolaires } from '@/services/annee-scolaire';
import { AppLayout } from '@/components/layout/AppLayout';
import { LienRetour } from '@/components/layout/LienRetour';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getSidebarItems } from '@/lib/navigation';
import { EnseignantForm } from './EnseignantForm';

export default async function NouvelEnseignantPage() {
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
      <div className="mx-auto max-w-4xl space-y-6">
        <LienRetour href="/etablissement/enseignants">Retour aux enseignants</LienRetour>

        <div>
          <h1 className="text-display-sm text-text-primary">Nouveau profil enseignant</h1>
          <p className="text-body-sm text-text-secondary">
            Saisissez les informations pour créer un nouveau dossier enseignant.
          </p>
        </div>

        {!anneeActive ? (
          <Card>
            <CardContent className="p-6">
              <p className="text-body-sm text-error">
                Activez une année scolaire avant de créer un enseignant (le matricule est numéroté
                par année).
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Identité et compte</CardTitle>
            </CardHeader>
            <CardContent>
              <EnseignantForm anneeScolaireId={anneeActive.id} />
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

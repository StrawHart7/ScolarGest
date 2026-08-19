import { getTenantContext } from '@/services/tenant';
import { getEleve } from '@/services/eleve';
import { listAnneesScolaires } from '@/services/annee-scolaire';
import { listClasses } from '@/services/classe';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getSidebarItems } from '@/lib/navigation';
import { InscriptionForm } from './InscriptionForm';

export default async function InscriptionPage({ params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  const eleve = await getEleve(params.id);
  const annees = await listAnneesScolaires();
  const anneeActive = annees.find((a) => a.statut === 'ACTIVE');
  const classes = anneeActive ? await listClasses(anneeActive.id) : [];

  return (
    <AppLayout
      items={getSidebarItems(ctx.role)}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-display-sm text-text-primary">Inscription en classe</h1>
          <p className="text-body-sm text-text-secondary">
            {eleve.nom} {eleve.prenoms} — <span data-mono>{eleve.matricule}</span>
          </p>
        </div>

        {!anneeActive ? (
          <Card>
            <CardContent className="p-6">
              <p className="text-body-sm text-error">Aucune année scolaire active.</p>
            </CardContent>
          </Card>
        ) : classes.length === 0 ? (
          <Card>
            <CardContent className="p-6">
              <p className="text-body-sm text-error">
                Aucune classe n&apos;existe pour l&apos;année active. Créez une classe avant d&apos;inscrire un
                élève.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Année active : {anneeActive.libelle}</CardTitle>
            </CardHeader>
            <CardContent>
              <InscriptionForm eleveId={eleve.id} anneeScolaireId={anneeActive.id} classes={classes} />
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

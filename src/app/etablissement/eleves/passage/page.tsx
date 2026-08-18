import { getTenantContext } from '@/services/tenant';
import { listAnneesScolaires } from '@/services/annee-scolaire';
import { listInscriptionsACloturer, proposerDecisions } from '@/services/passage-annee';
import { listClasses } from '@/services/classe';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getSidebarItems } from '@/lib/navigation';
import { PassageCohorteForm } from './PassageCohorteForm';

export default async function PassageCohortePage({
  searchParams,
}: {
  searchParams: { anneeSourceId?: string; anneeCibleId?: string };
}) {
  const ctx = await getTenantContext();
  const annees = await listAnneesScolaires();
  const anneeActive = annees.find((a) => a.statut === 'ACTIVE');
  const anneeSourceId = searchParams.anneeSourceId ?? anneeActive?.id;
  const autresAnnees = annees.filter((a) => a.id !== anneeSourceId);
  const anneeCibleId = searchParams.anneeCibleId;

  const inscriptions = anneeSourceId ? await listInscriptionsACloturer(anneeSourceId) : [];
  const decisions = proposerDecisions(inscriptions);
  const classesCibles = anneeCibleId ? await listClasses(anneeCibleId) : [];

  return (
    <AppLayout
      items={getSidebarItems(ctx.role)}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-display-sm text-text-primary">Passage de cohorte — fin d&apos;année</h1>
          <p className="text-body-sm text-text-secondary">
            Décision de fin d&apos;année élève par élève : passage à l&apos;année suivante, redoublement ou
            départ.
          </p>
        </div>

        {!anneeSourceId ? (
          <Card>
            <CardContent className="p-6">
              <p className="text-body-sm text-error">Aucune année scolaire disponible.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Élèves à traiter ({decisions.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <PassageCohorteForm
                anneeSourceId={anneeSourceId}
                autresAnnees={autresAnnees}
                anneeCibleId={anneeCibleId}
                decisions={decisions}
                classesCibles={classesCibles}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

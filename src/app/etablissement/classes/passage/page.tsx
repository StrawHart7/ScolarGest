import { Users2 } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { listAnneesScolaires } from '@/services/annee-scolaire';
import { listInscriptionsACloturer, proposerDecisions } from '@/services/passage-annee';
import { listClasses } from '@/services/classe';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { getSidebarItems } from '@/lib/navigation';
import { PassageCohorteForm } from './PassageCohorteForm';

export default async function PassageCohortePage({
  searchParams,
}: {
  searchParams: { anneeSourceId?: string; anneeCibleId?: string; classeId?: string };
}) {
  const [ctx, annees] = await Promise.all([getTenantContext(), listAnneesScolaires()]);
  const anneeActive = annees.find((a) => a.statut === 'ACTIVE');
  const anneeSourceId = searchParams.anneeSourceId ?? anneeActive?.id;
  const autresAnnees = annees.filter((a) => a.id !== anneeSourceId);
  const anneeCibleId = searchParams.anneeCibleId;

  const classesSource = anneeSourceId ? await listClasses(anneeSourceId) : [];
  // Une classe par défaut plutôt que tout l'établissement : le conseil de
  // classe se tient classe par classe.
  const classeId = searchParams.classeId ?? classesSource[0]?.id;

  const inscriptions =
    anneeSourceId && classeId ? await listInscriptionsACloturer(anneeSourceId, classeId) : [];
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
          <h1 className="text-display-sm text-text-primary">
            Passage de cohorte — fin d&apos;année
          </h1>
          <p className="text-body-sm text-text-secondary">
            Décision de fin d&apos;année élève par élève : passage à l&apos;année suivante,
            redoublement ou départ. Le traitement se fait classe par classe.
          </p>
        </div>

        {!anneeSourceId ? (
          <Card>
            <CardContent className="p-6">
              <p className="text-body-sm text-error">Aucune année scolaire disponible.</p>
            </CardContent>
          </Card>
        ) : classesSource.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
              <Users2 className="h-10 w-10 text-text-secondary/50" aria-hidden />
              <p className="text-body-md text-text-primary">
                Aucune classe sur l&apos;année source.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <PassageCohorteForm
              // Remonter le formulaire au changement de classe évite de
              // conserver les décisions saisies pour la classe précédente.
              key={`${anneeSourceId}-${classeId}`}
              anneeSourceId={anneeSourceId}
              autresAnnees={autresAnnees}
              anneeCibleId={anneeCibleId}
              classesSource={classesSource.map((c) => ({ id: c.id, nom: c.nom }))}
              classeId={classeId ?? ''}
              decisions={decisions}
              classesCibles={classesCibles}
            />
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

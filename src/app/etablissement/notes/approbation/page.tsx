import { ClipboardCheck } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { requireRole } from '@/services/authorization';
import { listNotesEnAttente, listEvaluationsSoumises } from '@/services/note';
import { getAnneeCourante } from '@/services/dashboard';
import { etatCollecteNotes } from '@/services/collecte-notes';
import type { Periode } from '@/services/evaluation';
import { AppLayout } from '@/components/layout/AppLayout';
import { BarreSection } from '@/components/layout/BarreSection';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getSidebarItems } from '@/lib/navigation';
import { periodesDuRegime } from '@/lib/periodes';
import { getRegimePeriodes } from '@/services/regime-periodes';
import { ApprobationQueue } from './ApprobationQueue';
import { SoumissionsQueue } from './SoumissionsQueue';
import { SuiviRemiseNotes } from './SuiviRemiseNotes';
import { etatDomaine } from '@/services/configuration';
import { PageVerrouillee } from '@/components/configuration/PageVerrouillee';

const CHEMIN = '/etablissement/notes/approbation';

export default async function ApprobationNotesPage({
  searchParams,
}: {
  searchParams: { periode?: string };
}) {
  // Garde explicite au niveau page, en plus de la garde déjà appliquée dans
  // les services listNotesEnAttente/listEvaluationsSoumises (défense en profondeur).
  await requireRole('DIRECTEUR', 'SECRETAIRE');

  const ctx = await getTenantContext();

  // Le verrou avant les lectures : afficher une liste vide sans dire
  // pourquoi est le defaut qu'on repare, et les requetes qui la
  // remplissent n'ont rien a ramener tant que la section n'est pas prete.
  const verrou = await etatDomaine('NOTES');
  if (!verrou.ouvert) {
    return (
      <PageVerrouillee
        domaine="NOTES"
        titre="Approbation des notes"
        retour={{ href: '/dashboard', libelle: 'Retour au tableau de bord' }}
        manques={verrou.manques}
      />
    );
  }
  // Une période absente de l'URL n'est pas une erreur : le service choisit
  // alors celle sur laquelle l'école travaille. Une période inventée est
  // ignorée de la même façon plutôt que de faire tomber la page.
  const periodeDemandee = periodesDuRegime().includes(searchParams.periode as Periode)
    ? (searchParams.periode as Periode)
    : undefined;

  // Deux periodes pour un lycee au semestre, trois sinon.
  const [annee, regime] = await Promise.all([getAnneeCourante(), getRegimePeriodes()]);

  const [soumissions, corrections, collecte] = await Promise.all([
    listEvaluationsSoumises(),
    listNotesEnAttente(),
    annee ? etatCollecteNotes(annee.id, periodeDemandee) : Promise.resolve(null),
  ]);

  return (
    <AppLayout
      items={getSidebarItems(ctx.role)}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="space-y-6">
        <BarreSection chemin="/etablissement/notes" role={ctx.role} actif="/etablissement/notes/approbation" />

        <PageHeader
          title="Approbation des notes"
          description="Les notes que vos enseignants ont rendues et qui attendent votre validation, et les corrections qu'ils demandent."
        />

        <Card>
          <CardHeader>
            <CardTitle>Soumissions à valider</CardTitle>
          </CardHeader>
          {soumissions.length === 0 ? (
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <ClipboardCheck className="h-10 w-10 text-text-secondary/50" aria-hidden />
              <p className="text-body-md text-text-primary">Rien à valider pour le moment. Les notes que vos enseignants soumettent apparaîtront ici.</p>
              <p className="max-w-lg text-body-sm text-text-secondary">
                Dès qu&apos;un enseignant soumet les notes d&apos;une évaluation, elle apparaît ici : les
                notes ne comptent dans les moyennes qu&apos;après votre validation.
              </p>
            </CardContent>
          ) : (
            <SoumissionsQueue soumissions={soumissions} />
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Demandes de correction</CardTitle>
          </CardHeader>
          {corrections.length === 0 ? (
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <ClipboardCheck className="h-10 w-10 text-text-secondary/50" aria-hidden />
              <p className="text-body-md text-text-primary">Aucune demande de correction. Un enseignant qui veut modifier une note déjà validée passe par ici.</p>
              <p className="max-w-lg text-body-sm text-text-secondary">
                Cette file ne reçoit que les demandes de <strong>correction</strong> d&apos;une note déjà
                validée.
              </p>
            </CardContent>
          ) : (
            <ApprobationQueue notes={corrections} />
          )}
        </Card>

        {/*
          En troisième : ce qui n'est pas encore arrivé. Les deux files
          au-dessus ne montrent que ce que les enseignants ont rendu — une
          école dont personne n'a rien saisi voyait donc deux écrans vides et
          en concluait que tout allait bien.
        */}
        {collecte ? <SuiviRemiseNotes collecte={collecte} base={CHEMIN} regime={regime} /> : null}
      </div>
    </AppLayout>
  );
}

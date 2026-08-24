import { ClipboardCheck } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { requireRole } from '@/services/authorization';
import { listNotesEnAttente, listEvaluationsSoumises } from '@/services/note';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getSidebarItems } from '@/lib/navigation';
import { ApprobationQueue } from './ApprobationQueue';
import { SoumissionsQueue } from './SoumissionsQueue';

export default async function ApprobationNotesPage() {
  // Garde explicite au niveau page, en plus de la garde déjà appliquée dans
  // les services listNotesEnAttente/listEvaluationsSoumises (défense en profondeur).
  await requireRole('SECRETAIRE');

  const ctx = await getTenantContext();
  const [soumissions, corrections] = await Promise.all([
    listEvaluationsSoumises(),
    listNotesEnAttente(),
  ]);

  return (
    <AppLayout
      items={getSidebarItems(ctx.role)}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="space-y-6">
        <PageHeader
          title="Approbation des notes"
          description="Soumissions d'évaluations et demandes de correction en attente d'une décision."
        />

        <Card>
          <CardHeader>
            <CardTitle>Soumissions à valider</CardTitle>
          </CardHeader>
          {soumissions.length === 0 ? (
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <ClipboardCheck className="h-10 w-10 text-text-secondary/50" aria-hidden />
              <p className="text-body-md text-text-primary">Aucune soumission en attente.</p>
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
              <p className="text-body-md text-text-primary">Aucune demande en attente.</p>
              <p className="max-w-lg text-body-sm text-text-secondary">
                Cette file ne reçoit que les demandes de <strong>correction</strong> d&apos;une note déjà
                validée.
              </p>
            </CardContent>
          ) : (
            <ApprobationQueue notes={corrections} />
          )}
        </Card>
      </div>
    </AppLayout>
  );
}

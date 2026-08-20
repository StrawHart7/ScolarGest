import { ClipboardCheck } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { requireRole } from '@/services/authorization';
import { listNotesEnAttente } from '@/services/note';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { getSidebarItems } from '@/lib/navigation';
import { ApprobationQueue } from './ApprobationQueue';

export default async function ApprobationNotesPage() {
  // Garde explicite au niveau page, en plus de la garde déjà appliquée dans
  // le service listNotesEnAttente (défense en profondeur).
  await requireRole('SECRETAIRE');

  const ctx = await getTenantContext();
  const notes = await listNotesEnAttente();

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
          description="Demandes de correction portant sur des notes déjà soumises, en attente d'une décision."
        />

        <Card>
          {notes.length === 0 ? (
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <ClipboardCheck className="h-10 w-10 text-text-secondary/50" aria-hidden />
              <p className="text-body-md text-text-primary">Aucune demande en attente.</p>
              {/* Confusion constatée à l'usage : soumettre des notes ne crée
                  aucune demande. Seule la correction d'une note déjà soumise
                  passe par cette file (doc 07 § 14). */}
              <p className="max-w-lg text-body-sm text-text-secondary">
                Soumettre des notes ne crée pas de demande : une note soumise par un enseignant est
                immédiatement officielle et entre dans les moyennes. Cette file ne reçoit que les
                demandes de <strong>correction</strong> d&apos;une note déjà soumise.
              </p>
            </CardContent>
          ) : (
            <ApprobationQueue notes={notes} />
          )}
        </Card>
      </div>
    </AppLayout>
  );
}

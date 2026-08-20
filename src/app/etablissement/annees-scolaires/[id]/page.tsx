import Link from 'next/link';
import { ArrowLeft, CalendarRange } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { getAnneeScolaire, listAnneesScolaires } from '@/services/annee-scolaire';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getSidebarItems } from '@/lib/navigation';
import { ActiverAnneeButton } from '../ActiverAnneeButton';

const STATUT_BADGE = {
  PREPARATION: 'neutral',
  ACTIVE: 'success',
  TERMINEE: 'neutral',
} as const;

export default async function AnneeScolaireDetailPage({ params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  const annee = await getAnneeScolaire(params.id);
  // Une activation est refusée tant qu'une autre année est active : on charge
  // l'année en cours pour l'expliquer avant le clic, pas après.
  const anneeActive = (await listAnneesScolaires()).find((a) => a.statut === 'ACTIVE');

  return (
    <AppLayout
      items={getSidebarItems(ctx.role)}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="mx-auto max-w-2xl space-y-6">
        <Link
          href="/etablissement/annees-scolaires"
          className="inline-flex items-center gap-1.5 text-body-sm text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Retour aux années scolaires
        </Link>

        <Card>
          <CardContent className="flex flex-col gap-6 p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-container/10 text-primary-container">
                <CalendarRange className="h-7 w-7" aria-hidden />
              </div>
              <div>
                <p className="text-headline-sm text-text-primary">{annee.libelle}</p>
                <p className="text-body-sm text-text-secondary">
                  {new Date(annee.dateDebut).toLocaleDateString('fr-FR')} —{' '}
                  {new Date(annee.dateFin).toLocaleDateString('fr-FR')}
                </p>
              </div>
              <Badge shape="pill" variant={STATUT_BADGE[annee.statut]} className="ml-auto">
                {annee.statut}
              </Badge>
            </div>

            <div className="flex items-center justify-between border-t border-surface-border pt-4">
              <Link
                href={`/etablissement/classes?anneeScolaireId=${annee.id}`}
                className="text-body-sm font-medium text-primary-container hover:text-primary"
              >
                Voir les classes de cette année
              </Link>
              {annee.statut === 'PREPARATION' && ctx.role === 'DIRECTEUR' && (
                <ActiverAnneeButton
                  anneeScolaireId={annee.id}
                  libelle={annee.libelle}
                  anneeActiveLibelle={anneeActive?.libelle}
                />
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

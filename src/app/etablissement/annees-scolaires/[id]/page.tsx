import Link from 'next/link';
import { CalendarRange } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { getAnneeScolaire, listAnneesScolaires } from '@/services/annee-scolaire';
import { apercuReconduction } from '@/services/reconduction';
import { AppLayout } from '@/components/layout/AppLayout';
import { LienRetour } from '@/components/layout/LienRetour';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getSidebarItems } from '@/lib/navigation';
import { ActiverAnneeButton } from '../ActiverAnneeButton';
import { ReprendreAnnee } from './ReprendreAnnee';

const STATUT_BADGE = {
  PREPARATION: 'neutral',
  ACTIVE: 'success',
  TERMINEE: 'neutral',
} as const;

export default async function AnneeScolaireDetailPage({ params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  const [annee, annees, apercu] = await Promise.all([
    getAnneeScolaire(params.id),
    // Une activation est refusée tant qu'une autre année est active : on charge
    // l'année en cours pour l'expliquer avant le clic, pas après.
    listAnneesScolaires(),
    apercuReconduction(params.id),
  ]);
  const anneeActive = annees.find((a) => a.statut === 'ACTIVE');
  // La reprise ne concerne que la direction, et n'a de sens que sur une année
  // qu'on prépare ou qu'on vient d'ouvrir — pas sur une année close.
  const peutReprendre =
    (ctx.role === 'DIRECTEUR' || ctx.role === 'SECRETAIRE') &&
    annee.statut !== 'TERMINEE' &&
    apercu.source !== null;

  return (
    <AppLayout
      items={getSidebarItems(ctx.role)}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="mx-auto max-w-2xl space-y-6">
        <LienRetour href="/etablissement/annees-scolaires">Retour aux années scolaires</LienRetour>

        <Card>
          <CardContent className="flex flex-col gap-6 p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-container/10 text-primary-container">
                <CalendarRange className="h-7 w-7" aria-hidden />
              </div>
              <div>
                <h1 className="text-display-sm text-text-primary">{annee.libelle}</h1>
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

            {peutReprendre && <ReprendreAnnee anneeScolaireId={annee.id} apercu={apercu} />}

            {peutReprendre && apercu.tarifsProposes > 0 && (
              <div className="border-t border-surface-border pt-4">
                <h2 className="text-body-md font-semibold text-text-primary">Tarifs</h2>
                <p className="mt-1 text-body-sm text-text-secondary">
                  {apercu.tarifsProposes} tarif(s) peuvent être repris de {apercu.source?.libelle}.
                  Ils sont <strong>proposés, pas posés</strong> : un tarif ne se modifie plus une
                  fois créé, et une rentrée est justement le moment où les prix changent.
                </p>
                <Link
                  href={`/etablissement/finances/tarifs?anneeScolaireId=${annee.id}`}
                  className="mt-2 inline-block text-body-sm font-medium text-primary-container hover:text-primary"
                >
                  Vérifier et valider les tarifs
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

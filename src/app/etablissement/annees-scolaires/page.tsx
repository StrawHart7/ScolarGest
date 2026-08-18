import Link from 'next/link';
import { getTenantContext } from '@/services/tenant';
import { listAnneesScolaires } from '@/services/annee-scolaire';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getSidebarItems } from '@/lib/navigation';
import { ActiverAnneeButton } from './ActiverAnneeButton';

const STATUT_BADGE = {
  PREPARATION: 'neutral',
  ACTIVE: 'success',
  TERMINEE: 'neutral',
} as const;

export default async function AnneesScolairesPage() {
  const ctx = await getTenantContext();
  const annees = await listAnneesScolaires();

  return (
    <AppLayout
      items={getSidebarItems(ctx.role)}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-display-sm text-text-primary">Années scolaires</h1>
            <p className="text-body-md text-text-secondary">
              Une seule année peut être active à la fois.
            </p>
          </div>
          <Button asChild>
            <Link href="/etablissement/annees-scolaires/nouvelle">Nouvelle année scolaire</Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Liste des années scolaires</CardTitle>
          </CardHeader>
          <CardContent>
            {annees.length === 0 ? (
              <p className="text-body-sm text-text-secondary">Aucune année scolaire créée.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-body-sm">
                  <thead>
                    <tr className="border-b border-surface-border text-left text-label-md text-text-secondary">
                      <th className="py-2 pr-4">Libellé</th>
                      <th className="py-2 pr-4">Début</th>
                      <th className="py-2 pr-4">Fin</th>
                      <th className="py-2 pr-4">Statut</th>
                      <th className="py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {annees.map((annee) => (
                      <tr
                        key={annee.id}
                        className="border-b border-surface-border transition-colors last:border-0 hover:bg-surface-container-low"
                      >
                        <td className="py-3 pr-4 font-medium">
                          <Link
                            href={`/etablissement/annees-scolaires/${annee.id}`}
                            className="text-text-primary hover:text-primary-container"
                          >
                            {annee.libelle}
                          </Link>
                        </td>
                        <td className="py-3 pr-4 text-text-secondary" data-mono>
                          {new Date(annee.dateDebut).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="py-3 pr-4 text-text-secondary" data-mono>
                          {new Date(annee.dateFin).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="py-3 pr-4">
                          <Badge variant={STATUT_BADGE[annee.statut]}>{annee.statut}</Badge>
                        </td>
                        <td className="py-3">
                          {annee.statut !== 'ACTIVE' && ctx.role === 'DIRECTEUR' && (
                            <ActiverAnneeButton anneeScolaireId={annee.id} />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

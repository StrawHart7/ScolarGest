import Link from 'next/link';
import { getTenantContext } from '@/services/tenant';
import { listAnneesScolaires } from '@/services/annee-scolaire';
import { listClasses } from '@/services/classe';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getSidebarItems } from '@/lib/navigation';

export default async function ClassesPage({
  searchParams,
}: {
  searchParams: { anneeScolaireId?: string };
}) {
  const ctx = await getTenantContext();
  const annees = await listAnneesScolaires();
  const anneeActive = annees.find((a) => a.statut === 'ACTIVE');
  const anneeScolaireId = searchParams.anneeScolaireId ?? anneeActive?.id;
  const classes = anneeScolaireId ? await listClasses(anneeScolaireId) : [];

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
            <h1 className="text-display-sm text-text-primary">Classes</h1>
            <p className="text-body-md text-text-secondary">
              {anneeActive ? `Année active : ${anneeActive.libelle}` : 'Aucune année active'}
            </p>
          </div>
          {ctx.role === 'DIRECTEUR' && anneeScolaireId && (
            <Button asChild>
              <Link href={`/etablissement/classes/nouvelle?anneeScolaireId=${anneeScolaireId}`}>
                Nouvelle classe
              </Link>
            </Button>
          )}
        </div>

        {!anneeScolaireId ? (
          <Card>
            <CardContent className="p-6">
              <p className="text-body-sm text-text-secondary">
                Créez et activez une année scolaire avant de créer des classes.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Liste des classes</CardTitle>
            </CardHeader>
            <CardContent>
              {classes.length === 0 ? (
                <p className="text-body-sm text-text-secondary">Aucune classe pour cette année.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-body-sm">
                    <thead>
                      <tr className="border-b border-surface-border text-left text-label-md text-text-secondary">
                        <th className="py-2 pr-4">Nom</th>
                        <th className="py-2 pr-4">Niveau</th>
                        <th className="py-2 pr-4">Série</th>
                        <th className="py-2">Capacité</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classes.map((classe) => (
                        <tr
                          key={classe.id}
                          className="border-b border-surface-border transition-colors last:border-0 hover:bg-surface-container-low"
                        >
                          <td className="py-3 pr-4 font-medium">
                            <Link
                              href={`/etablissement/classes/${classe.id}`}
                              className="text-text-primary hover:text-primary-container"
                            >
                              {classe.nom}
                            </Link>
                          </td>
                          <td className="py-3 pr-4 text-text-secondary">{classe.niveau.nom}</td>
                          <td className="py-3 pr-4 text-text-secondary">{classe.serie?.nom ?? '—'}</td>
                          <td className="py-3 text-text-secondary" data-mono>
                            {classe.capacite ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

import { Calculator } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { listCyclesActifs, listNiveauxParCycle, listSeriesParCycle } from '@/services/structure';
import { listAnneesScolaires } from '@/services/annee-scolaire';
import { listProgramme } from '@/services/programme';
import { getCoefficient } from '@/services/coefficient';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { getSidebarItems } from '@/lib/navigation';
import { NiveauSelector, type NiveauOption } from '../NiveauSelector';
import { SerieSelector } from './SerieSelector';
import { CoefficientRow } from './CoefficientRow';

export default async function CoefficientsPage({
  searchParams,
}: {
  searchParams: { niveauId?: string; serieId?: string };
}) {
  const ctx = await getTenantContext();
  const canWrite = ctx.role === 'DIRECTEUR' || ctx.role === 'SECRETAIRE';

  const [cyclesActifs, annees] = await Promise.all([listCyclesActifs(), listAnneesScolaires()]);
  const anneeActive = annees.find((a) => a.statut === 'ACTIVE') ?? null;

  const niveauxParCycle = await Promise.all(
    cyclesActifs.map(async (ce) => ({
      cycleId: ce.cycleId,
      cycleNom: ce.cycle.nom,
      niveaux: await listNiveauxParCycle(ce.cycleId),
    })),
  );
  const niveaux: NiveauOption[] = niveauxParCycle.flatMap((c) =>
    c.niveaux.map((n) => ({ id: n.id, nom: n.nom, cycleNom: c.cycleNom })),
  );

  const niveauId = searchParams.niveauId ?? niveaux[0]?.id;
  const cycleDuNiveau = niveauxParCycle.find((c) => c.niveaux.some((n) => n.id === niveauId));
  const series = cycleDuNiveau ? await listSeriesParCycle(cycleDuNiveau.cycleId) : [];
  const serieId = series.some((s) => s.id === searchParams.serieId) ? (searchParams.serieId ?? null) : null;

  const programme = niveauId ? await listProgramme(niveauId) : [];

  const lignes = anneeActive
    ? await Promise.all(
        programme.map(async (p) => ({
          programme: p,
          coefficient: await getCoefficient(p.id, anneeActive.id, serieId),
        })),
      )
    : [];

  return (
    <AppLayout
      items={getSidebarItems(ctx.role)}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-display-sm text-text-primary">Coefficients</h1>
          <p className="text-body-md text-text-secondary">
            Coefficients par matière, niveau, série (le cas échéant) et année scolaire — historisés
            par année : modifier l&apos;année en cours met à jour la valeur, une nouvelle année crée
            une nouvelle entrée.
          </p>
        </div>

        {!anneeActive ? (
          <Card>
            <CardContent className="py-10 text-center text-body-md text-text-secondary">
              Aucune année scolaire active — activez-en une avant de définir des coefficients.
            </CardContent>
          </Card>
        ) : niveaux.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <Calculator className="h-10 w-10 text-text-secondary/50" aria-hidden />
              <p className="text-body-md text-text-primary">
                Aucun niveau disponible — activez un cycle dans Cycles.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <NiveauSelector
                niveaux={niveaux}
                value={niveauId ?? ''}
                basePath="/etablissement/programme/coefficients"
              />
              {series.length > 0 && niveauId && (
                <SerieSelector niveauId={niveauId} series={series} value={serieId ?? 'aucune'} />
              )}
              <span className="text-body-sm text-text-secondary">
                Année active : {anneeActive.libelle}
              </span>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Coefficients du niveau</CardTitle>
              </CardHeader>
              {programme.length === 0 ? (
                <CardContent className="py-10 text-center text-body-md text-text-secondary">
                  Ce niveau n&apos;a aucune matière au programme. Ajoutez-en dans « Programme par
                  niveau ».
                </CardContent>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Matière</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Coefficient</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lignes.map(({ programme: p, coefficient }) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.matiere.nom}</TableCell>
                        <TableCell className="text-text-secondary">
                          {p.obligatoire ? 'Obligatoire' : 'Facultative'}
                        </TableCell>
                        <TableCell>
                          {canWrite ? (
                            <CoefficientRow
                              programmeEtablissementId={p.id}
                              anneeScolaireId={anneeActive.id}
                              serieId={serieId}
                              coefficientActuel={coefficient?.coefficient ?? null}
                            />
                          ) : (
                            (coefficient?.coefficient ?? '—')
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}

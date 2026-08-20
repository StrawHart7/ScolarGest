import { Calculator } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { listCyclesActifs, listNiveauxParCycle, listSeriesParCycle } from '@/services/structure';
import { listAnneesScolaires } from '@/services/annee-scolaire';
import { listProgramme } from '@/services/programme';
import { listCoefficients } from '@/services/coefficient';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { getSidebarItems } from '@/lib/navigation';
import { NiveauSelector, type NiveauOption } from '../NiveauSelector';
import { SerieSelector } from './SerieSelector';
import { CoefficientsForm, type LigneCoefficient } from './CoefficientsForm';

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
  const serieId = series.some((s) => s.id === searchParams.serieId)
    ? (searchParams.serieId ?? null)
    : null;

  const programme = niveauId ? await listProgramme(niveauId) : [];

  // Une seule requête pour tous les coefficients du niveau, au lieu d'un
  // `getCoefficient()` par matière.
  const coefficients = anneeActive
    ? await listCoefficients(
        programme.map((p) => p.id),
        anneeActive.id,
        serieId,
      )
    : new Map<string, number>();

  const lignes: LigneCoefficient[] = programme.map((p) => ({
    programmeEtablissementId: p.id,
    matiereNom: p.matiere.nom,
    obligatoire: p.obligatoire,
    coefficient: coefficients.get(p.id) ?? null,
  }));

  const serieCourante = series.find((s) => s.id === serieId);

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
          <p className="max-w-3xl text-body-md text-text-secondary">
            Coefficients par matière, niveau, série et année scolaire. Ils sont historisés par
            année : modifier l&apos;année en cours met à jour la valeur, une nouvelle année crée une
            nouvelle entrée — les bulletins déjà édités ne changent jamais.
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
          <Card>
            <div className="flex flex-wrap items-center gap-3 border-b border-surface-border p-4">
              <NiveauSelector
                niveaux={niveaux}
                value={niveauId ?? ''}
                basePath="/etablissement/programme/coefficients"
              />
              {series.length > 0 && niveauId && (
                <SerieSelector niveauId={niveauId} series={series} value={serieId ?? 'aucune'} />
              )}
              <span className="ml-auto text-body-sm text-text-secondary">
                Année {anneeActive.libelle}
                {serieCourante ? ` — série ${serieCourante.nom}` : ''}
              </span>
            </div>

            {programme.length === 0 ? (
              <CardContent className="py-10 text-center text-body-md text-text-secondary">
                Ce niveau n&apos;a aucune matière au programme. Ajoutez-en dans « Programme par
                niveau ».
              </CardContent>
            ) : (
              <CoefficientsForm
                // Remonter le formulaire au changement de niveau ou de série
                // garantit que les champs repartent des valeurs de la
                // sélection courante.
                key={`${niveauId}-${serieId ?? 'sans-serie'}`}
                anneeScolaireId={anneeActive.id}
                serieId={serieId}
                lignes={lignes}
                modifiable={canWrite}
              />
            )}
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

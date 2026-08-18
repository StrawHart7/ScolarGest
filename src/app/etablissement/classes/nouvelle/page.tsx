import { listCyclesActifs, listNiveauxParCycle, listSeriesParCycle } from '@/services/structure';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ClasseForm, type CycleOption } from './ClasseForm';

export default async function NouvelleClassePage({
  searchParams,
}: {
  searchParams: { anneeScolaireId?: string };
}) {
  const anneeScolaireId = searchParams.anneeScolaireId;
  const cyclesActifs = await listCyclesActifs();

  const cycles: CycleOption[] = await Promise.all(
    cyclesActifs.map(async (ce) => {
      const estLycee = ce.cycle.nom === 'LYCEE';
      const [niveaux, series] = await Promise.all([
        listNiveauxParCycle(ce.cycleId),
        estLycee ? listSeriesParCycle(ce.cycleId) : Promise.resolve([]),
      ]);
      return { id: ce.cycleId, nom: ce.cycle.nom, estLycee, niveaux, series };
    }),
  );

  return (
    <main className="mx-auto max-w-xl p-container-pad">
      <h1 className="mb-6 text-display-sm text-text-primary">Nouvelle classe</h1>

      {!anneeScolaireId ? (
        <p className="text-body-sm text-error">Année scolaire manquante.</p>
      ) : cycles.length === 0 ? (
        <p className="text-body-sm text-error">
          Activez au moins un cycle avant de créer une classe (page Cycles).
        </p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Détails</CardTitle>
          </CardHeader>
          <CardContent>
            <ClasseForm anneeScolaireId={anneeScolaireId} cycles={cycles} />
          </CardContent>
        </Card>
      )}
    </main>
  );
}

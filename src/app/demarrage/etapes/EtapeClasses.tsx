'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ErreurEtape, PuceChoix } from '../Bulles';
import { LETTRES_DIVISION } from '@/lib/onboarding/suggestions';
import { creerClassesAction } from '../actions';

export interface NiveauAvecCycle {
  id: string;
  nom: string;
  ordre: number;
  cycleId: string;
  cycleNom: string;
}

export interface SerieCycle {
  id: string;
  nom: string;
  cycleId: string;
}

interface ClasseACreer {
  niveauId: string;
  serieId: string | null;
  nom: string;
}

/**
 * Cette étape porte deux décisions à la fois : *quels niveaux sont enseignés*
 * (un compteur à zéro veut dire « pas ce niveau ») et *combien de divisions*
 * par niveau. Les deux sont fusionnées parce que la première ne s'écrit nulle
 * part — sans table `niveau_etablissement`, un niveau n'est « enseigné » que
 * parce qu'une classe existe dessus. À la reprise, le périmètre se redéduit
 * donc des classes déjà créées.
 *
 * Au lycée, une classe se distingue aussi par sa série : le nom devient
 * « Tle D1 », « Tle D2 », la série remplaçant la lettre de division.
 */
export function EtapeClasses({
  anneeScolaireId,
  niveaux,
  series,
  onTermine,
}: {
  anneeScolaireId: string;
  niveaux: NiveauAvecCycle[];
  series: SerieCycle[];
  onTermine: () => void;
}) {
  const [divisions, setDivisions] = React.useState<Record<string, number>>({});
  const [seriesParNiveau, setSeriesParNiveau] = React.useState<Record<string, string[]>>({});
  const [erreur, setErreur] = React.useState<string | null>(null);
  const [enCours, setEnCours] = React.useState(false);

  const niveauxParCycle = React.useMemo(() => {
    const groupes = new Map<string, NiveauAvecCycle[]>();
    for (const niveau of niveaux) {
      const liste = groupes.get(niveau.cycleNom) ?? [];
      liste.push(niveau);
      groupes.set(niveau.cycleNom, liste);
    }
    return [...groupes.entries()];
  }, [niveaux]);

  function reglerDivisions(niveauId: string, valeur: number) {
    setDivisions((prec) => ({ ...prec, [niveauId]: Math.max(0, Math.min(8, valeur)) }));
  }

  function basculerSerie(niveauId: string, serieId: string) {
    setSeriesParNiveau((prec) => {
      const actuelles = prec[niveauId] ?? [];
      return {
        ...prec,
        [niveauId]: actuelles.includes(serieId)
          ? actuelles.filter((id) => id !== serieId)
          : [...actuelles, serieId],
      };
    });
  }

  /** Construit la liste des classes à créer, noms compris. */
  const classes = React.useMemo<ClasseACreer[]>(() => {
    const resultat: ClasseACreer[] = [];
    for (const niveau of niveaux) {
      const seriesDuCycle = series.filter((s) => s.cycleId === niveau.cycleId);
      const nombre = divisions[niveau.id] ?? 0;

      if (seriesDuCycle.length > 0) {
        // Niveau à séries : une classe par série retenue, numérotée si
        // plusieurs divisions sont demandées pour la même série.
        const retenues = seriesParNiveau[niveau.id] ?? [];
        for (const serieId of retenues) {
          const serie = seriesDuCycle.find((s) => s.id === serieId);
          if (!serie) continue;
          const parSerie = Math.max(1, nombre);
          for (let i = 0; i < parSerie; i += 1) {
            resultat.push({
              niveauId: niveau.id,
              serieId,
              nom: parSerie > 1 ? `${niveau.nom} ${serie.nom}${i + 1}` : `${niveau.nom} ${serie.nom}`,
            });
          }
        }
        continue;
      }

      for (let i = 0; i < nombre; i += 1) {
        // Le compteur est borné à 8 comme LETTRES_DIVISION, mais l'index reste
        // typé comme potentiellement absent (`noUncheckedIndexedAccess`).
        const lettre = LETTRES_DIVISION[i] ?? String(i + 1);
        resultat.push({
          niveauId: niveau.id,
          serieId: null,
          nom: `${niveau.nom} ${lettre}`,
        });
      }
    }
    return resultat;
  }, [niveaux, series, divisions, seriesParNiveau]);

  async function valider() {
    setErreur(null);
    setEnCours(true);
    const resultat = await creerClassesAction({ anneeScolaireId, classes });
    setEnCours(false);
    if (!resultat.ok) {
      setErreur(resultat.message);
      return;
    }
    onTermine();
  }

  return (
    <div className="mt-4 flex flex-col gap-5">
      {niveauxParCycle.map(([cycleNom, niveauxDuCycle]) => (
        <div key={cycleNom} className="flex flex-col gap-2">
          <p className="text-label-md uppercase text-text-secondary">{cycleNom}</p>
          {niveauxDuCycle.map((niveau) => {
            const seriesDuCycle = series.filter((s) => s.cycleId === niveau.cycleId);
            const aDesSeries = seriesDuCycle.length > 0;
            const retenues = seriesParNiveau[niveau.id] ?? [];
            return (
              <div
                key={niveau.id}
                className="rounded-lg border border-surface-border bg-surface-container-low p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-body-md font-medium text-text-primary">{niveau.nom}</span>
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor={`divisions-${niveau.id}`}
                      className="text-body-sm text-text-secondary"
                    >
                      {aDesSeries ? 'Divisions par série' : 'Nombre de classes'}
                    </label>
                    <Input
                      id={`divisions-${niveau.id}`}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={8}
                      value={divisions[niveau.id] ?? 0}
                      onChange={(e) => reglerDivisions(niveau.id, Number(e.target.value))}
                      className="h-9 w-20 text-center"
                    />
                  </div>
                </div>
                {aDesSeries && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {seriesDuCycle.map((serie) => (
                      <PuceChoix
                        key={serie.id}
                        selectionne={retenues.includes(serie.id)}
                        onClick={() => basculerSerie(niveau.id, serie.id)}
                      >
                        {serie.nom}
                      </PuceChoix>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {classes.length > 0 && (
        <div className="rounded-lg border border-surface-border bg-surface-container-lowest p-3">
          <p className="text-label-md uppercase text-text-secondary">
            {classes.length} classe{classes.length > 1 ? 's' : ''} à créer
          </p>
          <p className="mt-1 text-body-sm text-text-primary">
            {classes.map((c) => c.nom).join(' · ')}
          </p>
        </div>
      )}

      <ErreurEtape message={erreur} />
      <div className="flex justify-end">
        <Button onClick={valider} disabled={enCours || classes.length === 0}>
          {enCours ? 'Création…' : `Créer ${classes.length || ''} classe${classes.length > 1 ? 's' : ''}`}
        </Button>
      </div>
    </div>
  );
}

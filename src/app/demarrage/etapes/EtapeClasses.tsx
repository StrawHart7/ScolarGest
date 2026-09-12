'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { appelerAction } from '../appel-action';
import { ErreurEtape } from '../Bulles';
import { LETTRES_DIVISION } from '@/lib/onboarding/suggestions';
import { creerClassesAction } from '../actions';

export interface NiveauAvecCycle {
  id: string;
  nom: string;
  /** Rang du niveau *dans son cycle* — il repart à 1 à chaque cycle. */
  ordre: number;
  cycleId: string;
  cycleNom: string;
  /** Rang du cycle. Nécessaire pour trier globalement : sans lui, un tri sur
   *  le seul `ordre` entrelace les cycles (6ème, 2nde, 5ème, 1ère…). */
  cycleOrdre: number;
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

/** Même forme de clé que `src/lib/filiere.ts` : série vide au collège. */
function cleDivision(niveauId: string, serieId: string | null): string {
  return `${niveauId}|${serieId ?? ''}`;
}

/**
 * Nom d'une classe.
 *
 * **Une classe seule ne porte pas d'indice** : une école qui n'a qu'une
 * sixième l'appelle « 6ème », pas « 6ème A ». L'indice ne sert qu'à distinguer,
 * et il n'y a rien à distinguer quand il n'y en a qu'une — la lettre se lit
 * alors comme la promesse d'une 6ème B qui n'existe pas.
 *
 * Au lycée, la série remplace la lettre : « Tle D » seule, « Tle D1 », « Tle D2 »
 * quand il y en a plusieurs. C'est l'usage togolais, et la série est de toute
 * façon plus distinctive qu'une lettre.
 */
function nommer(
  niveauNom: string,
  serieNom: string | null,
  total: number,
  index: number,
): string {
  if (serieNom) {
    return total === 1 ? `${niveauNom} ${serieNom}` : `${niveauNom} ${serieNom}${index + 1}`;
  }
  if (total === 1) return niveauNom;
  return `${niveauNom} ${LETTRES_DIVISION[index] ?? String(index + 1)}`;
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
  /**
   * Nombre de divisions par **combinaison niveau/série**, et non par niveau.
   *
   * Un seul compteur par niveau ne savait pas dire « trois Terminales D et une
   * Terminale C » : il appliquait le même nombre à toutes les séries retenues.
   * C'est pourtant le cas ordinaire d'un lycée, où une série domine largement
   * les autres.
   *
   * La clé est `niveauId|serieId`, `serieId` vide au collège — même forme que
   * `src/lib/filiere.ts`. Et le compteur porte à lui seul le fait d'enseigner
   * la série : zéro veut dire « pas cette série », exactement comme zéro veut
   * dire « pas ce niveau ». Les pastilles de sélection ont donc disparu, elles
   * disaient deux fois la même chose.
   */
  const [divisions, setDivisions] = React.useState<Record<string, number>>({});
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

  function reglerDivisions(niveauId: string, serieId: string | null, valeur: number) {
    const cle = cleDivision(niveauId, serieId);
    setDivisions((prec) => ({ ...prec, [cle]: Math.max(0, Math.min(8, valeur)) }));
  }

  /** Construit la liste des classes à créer, noms compris. */
  const classes = React.useMemo<ClasseACreer[]>(() => {
    const resultat: ClasseACreer[] = [];
    for (const niveau of niveaux) {
      const seriesDuCycle = series.filter((s) => s.cycleId === niveau.cycleId);

      if (seriesDuCycle.length > 0) {
        for (const serie of seriesDuCycle) {
          const nombre = divisions[cleDivision(niveau.id, serie.id)] ?? 0;
          for (let i = 0; i < nombre; i += 1) {
            resultat.push({
              niveauId: niveau.id,
              serieId: serie.id,
              nom: nommer(niveau.nom, serie.nom, nombre, i),
            });
          }
        }
        continue;
      }

      const nombre = divisions[cleDivision(niveau.id, null)] ?? 0;
      for (let i = 0; i < nombre; i += 1) {
        resultat.push({
          niveauId: niveau.id,
          serieId: null,
          nom: nommer(niveau.nom, null, nombre, i),
        });
      }
    }
    return resultat;
  }, [niveaux, series, divisions]);

  async function valider() {
    setErreur(null);
    setEnCours(true);
    const resultat = await appelerAction(() => creerClassesAction({ anneeScolaireId, classes }));
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
            return (
              <div
                key={niveau.id}
                className="rounded-lg border border-surface-border bg-surface-container-low p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-body-md font-medium text-text-primary">{niveau.nom}</span>
                  {seriesDuCycle.length === 0 && (
                    <div className="flex items-center gap-2">
                      <label
                        htmlFor={`divisions-${niveau.id}`}
                        className="text-body-sm text-text-secondary"
                      >
                        Nombre de classes
                      </label>
                      <Input
                        id={`divisions-${niveau.id}`}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={8}
                        value={divisions[cleDivision(niveau.id, null)] ?? 0}
                        onChange={(e) => reglerDivisions(niveau.id, null, Number(e.target.value))}
                        className="h-row-standard w-20 text-center"
                      />
                    </div>
                  )}
                </div>
                {seriesDuCycle.length > 0 && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {seriesDuCycle.map((serie) => (
                      <div
                        key={serie.id}
                        className="flex items-center justify-between gap-2 rounded-lg bg-surface-container-lowest px-3 py-2"
                      >
                        <label
                          htmlFor={`divisions-${niveau.id}-${serie.id}`}
                          className="text-body-sm text-text-primary"
                        >
                          {serie.nom}
                        </label>
                        <Input
                          id={`divisions-${niveau.id}-${serie.id}`}
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={8}
                          value={divisions[cleDivision(niveau.id, serie.id)] ?? 0}
                          onChange={(e) =>
                            reglerDivisions(niveau.id, serie.id, Number(e.target.value))
                          }
                          className="h-row-standard w-20 text-center"
                        />
                      </div>
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
          {enCours
            ? 'Création…'
            : classes.length === 0
              ? 'Créer les classes'
              : `Créer ${classes.length} classe${classes.length > 1 ? 's' : ''}`}
        </Button>
      </div>
    </div>
  );
}

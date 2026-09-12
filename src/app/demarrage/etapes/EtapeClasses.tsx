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
function nommer(niveauNom: string, serieNom: string | null, total: number, index: number): string {
  if (serieNom) {
    return total === 1 ? `${niveauNom} ${serieNom}` : `${niveauNom} ${serieNom}${index + 1}`;
  }
  if (total === 1) return niveauNom;
  return `${niveauNom} ${LETTRES_DIVISION[index] ?? String(index + 1)}`;
}

/**
 * Une ligne réglable, et l'aperçu de ce qu'elle produit.
 *
 * **La ligne est ce qui reçoit un compteur** — un niveau au collège, une série
 * au lycée — et jamais « un niveau, parfois accompagné de sous-lignes ». La
 * version précédente mélangeait les deux formes dans la même liste : compteur à
 * droite pour un niveau de collège, sous-grille en dessous pour un niveau de
 * lycée. L'œil devait réapprendre la ligne à chaque niveau.
 *
 * **L'aperçu est dans la ligne, pas en bas de page.** Voir « 6ème » devenir
 * « 6ème A · 6ème B » au moment où l'on passe de 1 à 2 est ce qui rend la règle
 * de nommage évidente sans l'expliquer. Reléguée dans un récapitulatif en bas,
 * la même information demandait un aller-retour du regard et n'apprenait rien.
 */
function LigneDivision({
  id,
  intitule,
  valeur,
  noms,
  onChange,
}: {
  id: string;
  intitule: string;
  valeur: number;
  noms: string[];
  onChange: (valeur: number) => void;
}) {
  const actif = valeur > 0;
  return (
    <div
      className={[
        'rounded-lg border px-3 py-2 transition-colors',
        actif
          ? 'border-primary/40 bg-primary/5'
          : 'border-surface-border bg-surface-container-lowest',
      ].join(' ')}
    >
      <div className="flex items-center justify-between gap-3">
        <label
          htmlFor={id}
          className={[
            'text-body-md',
            actif ? 'font-medium text-text-primary' : 'text-text-secondary',
          ].join(' ')}
        >
          {intitule}
        </label>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label={`Retirer une classe de ${intitule}`}
            onClick={() => onChange(valeur - 1)}
            disabled={valeur <= 0}
            className="flex h-row-standard w-row-standard items-center justify-center rounded-lg border border-surface-border text-body-lg text-text-secondary transition-colors hover:bg-surface-container-low disabled:opacity-30"
          >
            −
          </button>
          <Input
            id={id}
            type="number"
            inputMode="numeric"
            min={0}
            max={8}
            value={valeur}
            onChange={(e) => onChange(Number(e.target.value))}
            className="h-row-standard w-14 text-center font-medium"
          />
          <button
            type="button"
            aria-label={`Ajouter une classe de ${intitule}`}
            onClick={() => onChange(valeur + 1)}
            disabled={valeur >= 8}
            className="flex h-row-standard w-row-standard items-center justify-center rounded-lg border border-surface-border text-body-lg text-text-secondary transition-colors hover:bg-surface-container-low disabled:opacity-30"
          >
            +
          </button>
        </div>
      </div>

      {actif && (
        <p className="mt-1.5 text-body-sm text-text-secondary">{noms.join(' · ')}</p>
      )}
    </div>
  );
}

/**
 * Cette étape porte deux décisions à la fois : *quels niveaux sont enseignés*
 * (un compteur à zéro veut dire « pas ce niveau ») et *combien de divisions*
 * par niveau. Les deux sont fusionnées parce que la première ne s'écrit nulle
 * part — sans table `niveau_etablissement`, un niveau n'est « enseigné » que
 * parce qu'une classe existe dessus. À la reprise, le périmètre se redéduit
 * donc des classes déjà créées.
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
   * dire « pas ce niveau ».
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

  /** Noms produits par une combinaison, dans l'ordre de création. */
  const nomsDe = React.useCallback(
    (niveauNom: string, serieNom: string | null, total: number) =>
      Array.from({ length: total }, (_, i) => nommer(niveauNom, serieNom, total, i)),
    [],
  );

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

  const niveauxRetenus = React.useMemo(
    () => new Set(classes.map((c) => c.niveauId)).size,
    [classes],
  );

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
      <p className="text-body-sm text-text-secondary">
        Laissez à zéro ce que vous n&apos;enseignez pas. Les noms se composent tout seuls, et
        s&apos;affichent sous chaque ligne.
      </p>

      {niveauxParCycle.map(([cycleNom, niveauxDuCycle]) => (
        <div key={cycleNom} className="flex flex-col gap-2">
          <p className="text-label-md uppercase text-text-secondary">{cycleNom}</p>

          {niveauxDuCycle.map((niveau) => {
            const seriesDuCycle = series.filter((s) => s.cycleId === niveau.cycleId);

            // Collège : le niveau **est** la ligne.
            if (seriesDuCycle.length === 0) {
              const valeur = divisions[cleDivision(niveau.id, null)] ?? 0;
              return (
                <LigneDivision
                  key={niveau.id}
                  id={`divisions-${niveau.id}`}
                  intitule={niveau.nom}
                  valeur={valeur}
                  noms={nomsDe(niveau.nom, null, valeur)}
                  onChange={(v) => reglerDivisions(niveau.id, null, v)}
                />
              );
            }

            // Lycée : le niveau devient un intertitre, et chaque série prend la
            // même forme de ligne qu'un niveau de collège. C'est ce qui rend la
            // liste homogène de bout en bout.
            return (
              <div key={niveau.id} className="flex flex-col gap-1.5 pt-1">
                <p className="text-body-sm font-medium text-text-primary">{niveau.nom}</p>
                <div className="flex flex-col gap-1.5 border-l-2 border-surface-border pl-3">
                  {seriesDuCycle.map((serie) => {
                    const valeur = divisions[cleDivision(niveau.id, serie.id)] ?? 0;
                    return (
                      <LigneDivision
                        key={serie.id}
                        id={`divisions-${niveau.id}-${serie.id}`}
                        intitule={serie.nom}
                        valeur={valeur}
                        noms={nomsDe(niveau.nom, serie.nom, valeur)}
                        onChange={(v) => reglerDivisions(niveau.id, serie.id, v)}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ))}

      <ErreurEtape message={erreur} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-body-sm text-text-secondary">
          {classes.length === 0
            ? 'Aucune classe pour le moment.'
            : `${classes.length} classe${classes.length > 1 ? 's' : ''} sur ${niveauxRetenus} niveau${niveauxRetenus > 1 ? 'x' : ''}.`}
        </p>
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

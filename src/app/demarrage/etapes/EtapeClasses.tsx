'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { appelerAction } from '../appel-action';
import { ErreurEtape, PuceChoix } from '../Bulles';
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
  capacite: number | null;
}

/**
 * Plafond d'effectif appliqué à toutes les classes créées ici.
 *
 * Une école togolaise a des salles de contenance comparable : demander la
 * taille moyenne une fois vaut mieux que la demander vingt fois, et infiniment
 * mieux que de ne jamais la demander — ce qui était le cas jusqu'au 2026-09-16,
 * laissant la répartition du tableau de bord et le rapport d'effectifs sans
 * référence pour toute école passée par le parcours guidé.
 *
 * Le champ est **facultatif** : une école qui ne plafonne pas ses effectifs
 * laisse vide, et chaque classe se règle ensuite depuis sa fiche.
 */
const CAPACITE_MAX = 500;

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
  /** Saisie libre : `''` vaut « pas de plafond », et c'est une réponse valable. */
  const [capacite, setCapacite] = React.useState('');
  const [erreur, setErreur] = React.useState<string | null>(null);
  const [enCours, setEnCours] = React.useState(false);

  const capaciteNombre = Number(capacite);
  const capaciteValide =
    capacite.trim() === '' ||
    (Number.isInteger(capaciteNombre) && capaciteNombre >= 1 && capaciteNombre <= CAPACITE_MAX);
  const capaciteAAppliquer =
    capacite.trim() === '' || !capaciteValide ? null : capaciteNombre;

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

  /**
   * Choisir une série la fait apparaître ; la déchoisir la retire.
   *
   * **La présence de la clé porte le choix**, pas une seconde liste d'état.
   * `undefined` veut dire « série non retenue », un nombre veut dire « retenue,
   * avec ce nombre de divisions ». Deux états parallèles auraient divergé au
   * premier oubli, et c'est `divisions` qui construit déjà les classes.
   *
   * Une série retenue démarre à 1 : on ne clique pas sur « D » pour créer zéro
   * Terminale D.
   */
  function basculerSerie(niveauId: string, serieId: string) {
    const cle = cleDivision(niveauId, serieId);
    setDivisions((prec) => {
      if (prec[cle] === undefined) return { ...prec, [cle]: 1 };
      const suivant = { ...prec };
      delete suivant[cle];
      return suivant;
    });
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
              capacite: capaciteAAppliquer,
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
          capacite: capaciteAAppliquer,
        });
      }
    }
    return resultat;
  }, [niveaux, series, divisions, capaciteAAppliquer]);

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
        Indiquez combien de classes vous ouvrez par niveau, et laissez à zéro ce que vous
        n&apos;enseignez pas. Au lycée, choisissez d&apos;abord vos séries. Les noms se composent
        tout seuls et s&apos;affichent sous chaque ligne.
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

            // Lycée : on choisit d'abord les séries, **puis** on compte.
            //
            // Une ligne réglable par série du cycle, c'est onze compteurs à zéro
            // par niveau — A4, C, D, E, F1 à F4, G1 à G3 — soit trente-trois
            // lignes pour un lycée qui en enseigne trois. Le testeur du
            // 2026-09-14 faisait défiler des séries techniques qu'il n'a
            // jamais ouvertes pour atteindre la sienne.
            //
            // Le geste redevient celui de l'école : « je fais A4, C et D ». La
            // rangée de puces dit ce qui existe, et seules les séries retenues
            // prennent un compteur.
            const retenues = seriesDuCycle.filter(
              (s) => divisions[cleDivision(niveau.id, s.id)] !== undefined,
            );
            return (
              <div key={niveau.id} className="flex flex-col gap-2 pt-1">
                <p className="text-body-sm font-medium text-text-primary">{niveau.nom}</p>

                <div className="flex flex-wrap gap-1.5">
                  {seriesDuCycle.map((serie) => (
                    <PuceChoix
                      key={serie.id}
                      selectionne={divisions[cleDivision(niveau.id, serie.id)] !== undefined}
                      onClick={() => basculerSerie(niveau.id, serie.id)}
                    >
                      {serie.nom}
                    </PuceChoix>
                  ))}
                </div>

                {retenues.length === 0 ? (
                  <p className="text-body-sm text-text-secondary">
                    Choisissez les séries enseignées en {niveau.nom}.
                  </p>
                ) : (
                  <div className="flex flex-col gap-1.5 border-l-2 border-surface-border pl-3">
                    {retenues.map((serie) => {
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
                )}
              </div>
            );
          })}
        </div>
      ))}

      {/* En bas, après les compteurs : c'est une réponse unique qui vaut pour
          tout ce qui vient d'être décidé au-dessus. La poser en tête ferait
          répondre avant de savoir sur quoi. */}
      <div className="flex flex-col gap-2 border-t border-surface-border pt-4">
        <label htmlFor="capacite-moyenne" className="text-body-md font-medium text-text-primary">
          Combien d’élèves par classe, en moyenne ?
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <Input
            id="capacite-moyenne"
            type="number"
            inputMode="numeric"
            min={1}
            max={CAPACITE_MAX}
            step={1}
            value={capacite}
            onChange={(e) => setCapacite(e.target.value)}
            placeholder="30"
            className="h-row-standard w-28"
          />
          <span className="text-body-sm text-text-secondary">élèves au plus par classe</span>
        </div>
        {capaciteValide ? (
          <p className="text-body-sm text-text-secondary">
            Facultatif. Le nombre s’applique à toutes les classes créées ici ; vous ajusterez une
            classe en particulier depuis sa fiche. Il n’empêche aucune inscription : il sert à
            signaler les classes qui débordent.
          </p>
        ) : (
          <p className="text-body-sm text-error">
            Indiquez un nombre entier entre 1 et {CAPACITE_MAX}, ou laissez vide.
          </p>
        )}
      </div>

      <ErreurEtape message={erreur} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-body-sm text-text-secondary">
          {classes.length === 0
            ? 'Aucune classe pour le moment.'
            : `${classes.length} classe${classes.length > 1 ? 's' : ''} sur ${niveauxRetenus} niveau${niveauxRetenus > 1 ? 'x' : ''}${capaciteAAppliquer ? `, ${capaciteAAppliquer} élèves au plus` : ''}.`}
        </p>
        <Button onClick={valider} disabled={enCours || classes.length === 0 || !capaciteValide}>
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

'use client';

import * as React from 'react';
import {
  periodesDuRegime,
  phrasePeriode,
  motPeriode,
  regimeDuCycle,
  regimeDominant,
  REGIME_PAR_DEFAUT,
  type NomCycle,
  type RegimePeriodes,
} from '@/lib/periodes';
import type { Periode } from '@/services/evaluation';

/**
 * Le découpage de l'année, disponible partout côté client.
 *
 * ## Pourquoi un contexte et non des props
 *
 * Une douzaine d'écrans proposent de choisir une période — saisie, résultats,
 * bulletins, rapports, statistiques, régénération d'un bulletin. Les faire
 * toutes recevoir le régime en props demanderait de toucher autant de pages
 * **et** leurs composants clients, et la première oubliée proposerait un
 * troisième trimestre à un lycée qui n'en a que deux, sans que rien ne le
 * signale.
 *
 * C'est exactement le raisonnement déjà retenu pour le moteur hors ligne :
 * monté une seule fois dans `AppLayout`, via une enveloppe serveur qui lit le
 * contexte tenant. Le même endroit, le même motif.
 *
 * ## Le contexte porte le lycée, pas l'école
 *
 * Depuis le 2026-09-15, le régime n'est plus une propriété de l'école : c'est
 * une propriété du **lycée**, et le collège est au trimestre quoi qu'il
 * arrive. Le contexte transporte donc deux choses — le choix du lycée, et les
 * cycles que l'école a ouverts — et c'est l'**appelant qui dit de quel cycle
 * il parle**.
 *
 * `usePeriodes(cycle)` est la forme normale : tout écran qui affiche une
 * classe connaît son cycle. `usePeriodes()` sans argument reste licite pour
 * les deux écrans qui n'ont aucune classe en vue, et retombe sur
 * `regimeDominant` — voir sa note, la règle n'y est pas arbitraire.
 *
 * ## La valeur par défaut n'est pas un accident
 *
 * Hors de `AppLayout` — une page publique, un écran d'authentification — le
 * contexte est absent et vaut `TRIMESTRE` sans aucun cycle. C'est le régime de
 * toutes les écoles en base : un composant égaré affiche le comportement
 * d'avant, pas une erreur.
 */
interface ValeurContexte {
  regimeLycee: RegimePeriodes;
  cyclesActifs: NomCycle[];
}

const CONTEXTE_PAR_DEFAUT: ValeurContexte = {
  regimeLycee: REGIME_PAR_DEFAUT,
  cyclesActifs: [],
};

const ContexteRegime = React.createContext<ValeurContexte>(CONTEXTE_PAR_DEFAUT);

export function RegimeProvider({
  regimeLycee,
  cyclesActifs,
  children,
}: {
  regimeLycee: RegimePeriodes;
  cyclesActifs: NomCycle[];
  children: React.ReactNode;
}) {
  // La valeur est mémoïsée sur son contenu et non sur l'identité du tableau :
  // `AppLayout` en fabrique un neuf à chaque rendu, et sans cela tout
  // consommateur du contexte se recalculerait à chaque navigation.
  const cle = cyclesActifs.join(',');
  const valeur = React.useMemo<ValeurContexte>(
    () => ({ regimeLycee, cyclesActifs: cle === '' ? [] : (cle.split(',') as NomCycle[]) }),
    [regimeLycee, cle],
  );

  return <ContexteRegime.Provider value={valeur}>{children}</ContexteRegime.Provider>;
}

/** Le régime du lycée de l'école, brut. Préférer `usePeriodes(cycle)`. */
export function useRegimeLycee(): RegimePeriodes {
  return React.useContext(ContexteRegime).regimeLycee;
}

/**
 * Nommer une période ligne par ligne, chacune avec son cycle.
 *
 * `usePeriodes` est un hook : il ne peut pas être appelé dans une boucle. Or
 * les files d'approbation mêlent des classes de collège et de lycée dans le
 * **même** tableau, et chaque ligne doit porter son propre mot — « 2e
 * trimestre » sur la 6e, « 2e semestre » sur la 2nde, l'une sous l'autre.
 *
 * D'où cette forme : un seul appel de hook, une fonction qui prend le cycle.
 */
export function useNommerPeriode(): (periode: Periode, cycle?: string | null) => string {
  const { regimeLycee } = React.useContext(ContexteRegime);
  return React.useCallback(
    (periode: Periode, cycle?: string | null) =>
      phrasePeriode(periode, regimeDuCycle(cycle, regimeLycee)),
    [regimeLycee],
  );
}

/**
 * Ce dont un écran a besoin pour proposer une période : la liste, et comment
 * la nommer. Deux entrées au lieu de trois quand le lycée est au semestre.
 *
 * @param cycle Le cycle de la classe affichée. L'omettre n'est justifié que
 *   sur un écran qui n'en montre aucune ; partout ailleurs, c'est ce paramètre
 *   qui fait dire « semestre » à un lycée et « trimestre » à son collège, dans
 *   la même école et sur le même écran.
 */
export function usePeriodes(cycle?: NomCycle | string | null): {
  periodes: Periode[];
  nommer: (periode: Periode) => string;
  mot: string;
} {
  const { regimeLycee, cyclesActifs } = React.useContext(ContexteRegime);
  const cyclesCle = cyclesActifs.join(',');

  return React.useMemo(() => {
    const regime =
      cycle == null
        ? regimeDominant(cyclesCle === '' ? [] : cyclesCle.split(','), regimeLycee)
        : regimeDuCycle(cycle, regimeLycee);

    return {
      periodes: periodesDuRegime(regime),
      nommer: (periode: Periode) => phrasePeriode(periode, regime),
      mot: motPeriode(regime),
    };
  }, [cycle, regimeLycee, cyclesCle]);
}

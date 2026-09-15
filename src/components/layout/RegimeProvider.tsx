'use client';

import * as React from 'react';
import {
  periodesDuRegime,
  phrasePeriode,
  motPeriode,
  REGIME_PAR_DEFAUT,
  type RegimePeriodes,
} from '@/lib/periodes';
import type { Periode } from '@/services/evaluation';

/**
 * Le régime de périodes de l'école, disponible partout côté client.
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
 * ## La valeur par défaut n'est pas un accident
 *
 * Hors de `AppLayout` — une page publique, un écran d'authentification — le
 * contexte est absent et vaut `TRIMESTRE`. C'est le régime de toutes les
 * écoles en base, et celui de toute école qui n'a rien choisi : un composant
 * égaré affiche donc le comportement d'avant, pas une erreur.
 */
const ContexteRegime = React.createContext<RegimePeriodes>(REGIME_PAR_DEFAUT);

export function RegimeProvider({
  regime,
  children,
}: {
  regime: RegimePeriodes;
  children: React.ReactNode;
}) {
  return <ContexteRegime.Provider value={regime}>{children}</ContexteRegime.Provider>;
}

export function useRegimePeriodes(): RegimePeriodes {
  return React.useContext(ContexteRegime);
}

/**
 * Ce dont un écran a besoin pour proposer une période : la liste, et comment
 * la nommer. Deux entrées au lieu de trois en régime semestriel.
 */
export function usePeriodes(): {
  periodes: Periode[];
  nommer: (periode: Periode) => string;
  mot: string;
} {
  const regime = useRegimePeriodes();
  return React.useMemo(
    () => ({
      periodes: periodesDuRegime(regime),
      nommer: (periode: Periode) => phrasePeriode(periode, regime),
      mot: motPeriode(regime),
    }),
    [regime],
  );
}

'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { appelerAction } from '../appel-action';
import { ErreurEtape, PuceChoix } from '../Bulles';
import type { Cycle } from '@/services/structure';
import { activerCyclesAction } from '../actions';
import { ChampPin } from './ChampPin';

const LIBELLE_CYCLE: Record<string, string> = {
  COLLEGE: 'Collège',
  LYCEE: 'Lycée',
};

/**
 * Activer un cycle rend ses niveaux disponibles pour la suite. Il n'existe pas
 * de table `niveau_etablissement` : la disponibilité d'un niveau découle
 * uniquement du cycle activé, et se matérialise ensuite par les classes créées
 * dessus.
 */
export function EtapeCycles({
  cycles,
  cyclesDejaActifs,
  onTermine,
}: {
  cycles: Cycle[];
  cyclesDejaActifs: string[];
  onTermine: () => void;
}) {
  const [selection, setSelection] = React.useState<string[]>([]);
  const [pin, setPin] = React.useState('');
  const [erreur, setErreur] = React.useState<string | null>(null);
  const [enCours, setEnCours] = React.useState(false);

  function basculer(cycleId: string) {
    setSelection((prec) =>
      prec.includes(cycleId) ? prec.filter((id) => id !== cycleId) : [...prec, cycleId],
    );
  }

  async function valider() {
    setErreur(null);
    setEnCours(true);
    const resultat = await appelerAction(() => activerCyclesAction({ cycleIds: selection, pin }));
    setEnCours(false);
    if (!resultat.ok) {
      setErreur(resultat.message);
      return;
    }
    onTermine();
  }

  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {cycles.map((cycle) => {
          const dejaActif = cyclesDejaActifs.includes(cycle.id);
          return (
            <PuceChoix
              key={cycle.id}
              selectionne={dejaActif || selection.includes(cycle.id)}
              desactive={dejaActif}
              onClick={() => basculer(cycle.id)}
            >
              {LIBELLE_CYCLE[cycle.nom] ?? cycle.nom}
              {dejaActif && <span className="text-[11px] opacity-80">(déjà actif)</span>}
            </PuceChoix>
          );
        })}
      </div>
      <ChampPin
        valeur={pin}
        onChange={setPin}
        aide="L'activation étant définitive, elle demande votre code de confirmation."
      />
      <ErreurEtape message={erreur} />
      <div className="flex justify-end">
        <Button onClick={valider} disabled={enCours || pin.length !== 6 || selection.length === 0}>
          {enCours ? 'Activation…' : 'Activer ces cycles'}
        </Button>
      </div>
    </div>
  );
}

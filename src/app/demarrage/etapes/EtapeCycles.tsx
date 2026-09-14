'use client';

import * as React from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { appelerAction } from '../appel-action';
import { ErreurEtape } from '../Bulles';
import type { Cycle } from '@/services/structure';
import { activerCyclesAction } from '../actions';
import { ChampPin } from './ChampPin';

const LIBELLE_CYCLE: Record<string, string> = {
  COLLEGE: 'Collège',
  LYCEE: 'Lycée',
};

/**
 * Les niveaux que le cycle ouvre, dits en clair.
 *
 * Un Directeur reconnaît « 6e, 5e, 4e, 3e » avant de reconnaître « collège » —
 * c'est le vocabulaire de son école. Et c'est la seule chose que l'étape
 * suivante utilisera : autant l'annoncer ici.
 */
const NIVEAUX_CYCLE: Record<string, string> = {
  COLLEGE: '6e, 5e, 4e, 3e',
  LYCEE: '2nde, 1re, Terminale',
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
      {/*
        Deux pastilles de la taille d'une étiquette ne se lisaient pas comme un
        choix : le testeur du 2026-09-14 n'a pas vu qu'il fallait cliquer. Il y
        a exactement deux options et tout l'espace d'une carte — les serrer
        n'économisait rien et coûtait la compréhension de l'étape la plus
        irréversible du parcours.

        Chaque cycle devient donc une vraie cible : une case, un nom, les
        niveaux qu'il ouvre. Le bouton porte `aria-pressed` — ce sont des
        interrupteurs, pas des liens.
      */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {cycles.map((cycle) => {
          const dejaActif = cyclesDejaActifs.includes(cycle.id);
          const choisi = dejaActif || selection.includes(cycle.id);
          return (
            <button
              key={cycle.id}
              type="button"
              aria-pressed={choisi}
              disabled={dejaActif}
              onClick={() => basculer(cycle.id)}
              className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition ${
                choisi
                  ? 'border-primary bg-primary/5'
                  : 'border-surface-border bg-surface-container-lowest hover:border-primary/50 hover:bg-primary/5'
              } ${dejaActif ? 'cursor-not-allowed opacity-70' : ''}`}
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                  choisi ? 'border-primary bg-primary text-primary-on' : 'border-outline'
                }`}
                aria-hidden
              >
                {choisi ? <Check className="h-3.5 w-3.5" /> : null}
              </span>
              <span className="min-w-0">
                <span className="block text-body-md font-medium text-text-primary">
                  {LIBELLE_CYCLE[cycle.nom] ?? cycle.nom}
                </span>
                <span className="block text-body-sm text-text-secondary">
                  {NIVEAUX_CYCLE[cycle.nom] ?? 'Niveaux de ce cycle'}
                </span>
                {dejaActif && (
                  <span className="mt-1 block text-body-sm text-text-secondary">Déjà actif</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-body-sm text-text-secondary">
        Cochez ce que votre établissement enseigne. Vous pouvez en choisir un ou les deux.
      </p>
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

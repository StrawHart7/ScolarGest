'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { ErreurEtape, PuceChoix } from '../Bulles';
import { definirProgrammeAction } from '../actions';
import type { NiveauAvecCycle } from './EtapeClasses';

export interface MatiereChoisissable {
  id: string;
  nom: string;
}

/**
 * Associe les matières à chaque niveau. Seuls les niveaux réellement enseignés
 * sont proposés — c'est-à-dire ceux sur lesquels une classe a été créée à
 * l'étape précédente, puisque rien d'autre ne matérialise ce périmètre en base.
 *
 * Tout est pré-coché : le tronc commun est la règle, et décocher deux ou trois
 * cases est plus rapide que d'en cocher quinze.
 */
export function EtapeProgramme({
  niveaux,
  matieres,
  onTermine,
}: {
  niveaux: NiveauAvecCycle[];
  matieres: MatiereChoisissable[];
  onTermine: () => void;
}) {
  const [parNiveau, setParNiveau] = React.useState<Record<string, string[]>>(() =>
    Object.fromEntries(niveaux.map((n) => [n.id, matieres.map((m) => m.id)])),
  );
  const [erreur, setErreur] = React.useState<string | null>(null);
  const [enCours, setEnCours] = React.useState(false);

  function basculer(niveauId: string, matiereId: string) {
    setParNiveau((prec) => {
      const actuelles = prec[niveauId] ?? [];
      return {
        ...prec,
        [niveauId]: actuelles.includes(matiereId)
          ? actuelles.filter((id) => id !== matiereId)
          : [...actuelles, matiereId],
      };
    });
  }

  async function valider() {
    setErreur(null);
    setEnCours(true);
    const resultat = await definirProgrammeAction({
      affectations: niveaux.map((n) => ({ niveauId: n.id, matiereIds: parNiveau[n.id] ?? [] })),
    });
    setEnCours(false);
    if (!resultat.ok) {
      setErreur(resultat.message);
      return;
    }
    onTermine();
  }

  return (
    <div className="mt-4 flex flex-col gap-4">
      {niveaux.map((niveau) => (
        <div
          key={niveau.id}
          className="rounded-lg border border-surface-border bg-surface-container-low p-3"
        >
          <p className="mb-2 text-body-md font-medium text-text-primary">{niveau.nom}</p>
          <div className="flex flex-wrap gap-2">
            {matieres.map((matiere) => (
              <PuceChoix
                key={matiere.id}
                selectionne={(parNiveau[niveau.id] ?? []).includes(matiere.id)}
                onClick={() => basculer(niveau.id, matiere.id)}
              >
                {matiere.nom}
              </PuceChoix>
            ))}
          </div>
        </div>
      ))}
      <ErreurEtape message={erreur} />
      <div className="flex justify-end">
        <Button onClick={valider} disabled={enCours || niveaux.length === 0}>
          {enCours ? 'Enregistrement…' : 'Enregistrer le programme'}
        </Button>
      </div>
    </div>
  );
}

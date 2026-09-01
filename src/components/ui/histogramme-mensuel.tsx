'use client';

import * as React from 'react';
import { calculerBornes, libelleMois } from '@/lib/graphes';
import { cn } from '@/lib/utils';

/**
 * Histogramme mensuel, chaque barre posee sur une piste claire.
 *
 * **La piste n'est pas decorative.** Elle materialise le plafond de l'axe, ce
 * qui permet de lire une proportion sans remonter aux graduations : une barre
 * qui remplit un tiers de sa piste vaut un tiers du maximum. Elle donne aussi
 * une presence aux mois a zero, qui autrement disparaitraient purement et
 * simplement — et un mois sans aucune inscription est une information, pas un
 * vide.
 *
 * Barres en HTML plutot qu'en SVG : la mise en page en flex gere seule
 * l'espacement a toute largeur, et chaque barre est un element survolable avec
 * sa propre zone de capture, sans calcul de coordonnees.
 */

export interface BarreMensuelle {
  mois: string;
  valeur: number;
}

interface Props {
  barres: BarreMensuelle[];
  /** Nom de l'unite au singulier, pour l'infobulle : « inscription ». */
  unite: string;
  className?: string;
}

export function HistogrammeMensuel({ barres, unite, className }: Props) {
  const [survole, setSurvole] = React.useState<number | null>(null);
  const bornes = React.useMemo(() => calculerBornes(barres.map((b) => b.valeur)), [barres]);

  return (
    <div className={cn('w-full', className)}>
      <div className="flex h-48 items-end gap-1.5 sm:gap-2">
        {barres.map((barre, i) => {
          const proportion = barre.valeur / bornes.max;
          const actif = survole === i;
          return (
            <div
              key={barre.mois}
              className="group relative flex h-full flex-1 flex-col justify-end"
              onPointerEnter={() => setSurvole(i)}
              onPointerLeave={() => setSurvole(null)}
            >
              {/* Piste : hauteur pleine, en fond. */}
              <div className="absolute inset-0 rounded-md bg-primary-fixed/35" aria-hidden />

              {/* Barre. `min-h` garantit qu'une valeur non nulle mais minuscule
                  reste visible — sinon un mois a 1 inscription se confondrait
                  avec un mois a zero. */}
              <div
                className={cn(
                  'relative rounded-md transition-colors',
                  actif ? 'bg-primary' : 'bg-primary-container',
                  barre.valeur > 0 && 'min-h-[3px]',
                )}
                style={{ height: `${proportion * 100}%` }}
              />

              {actif && (
                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 rounded-lg bg-inverse-surface px-3 py-2 shadow-lg">
                  <p className="whitespace-nowrap text-label-md capitalize text-inverse-on-surface/70">
                    {libelleMois(barre.mois)} {barre.mois.slice(0, 4)}
                  </p>
                  <p className="whitespace-nowrap text-body-md font-semibold text-inverse-on-surface">
                    {barre.valeur.toLocaleString('fr-FR')} {unite}
                    {barre.valeur > 1 ? 's' : ''}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex gap-1.5 sm:gap-2">
        {barres.map((barre, i) => (
          <span
            key={barre.mois}
            className={cn(
              'flex-1 text-center text-label-md capitalize transition-colors',
              survole === i ? 'font-semibold text-text-primary' : 'text-text-secondary',
            )}
          >
            {libelleMois(barre.mois)}
          </span>
        ))}
      </div>
    </div>
  );
}

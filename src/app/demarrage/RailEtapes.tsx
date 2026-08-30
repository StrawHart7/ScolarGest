'use client';

import { Check, SkipForward } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DefinitionEtape, IdEtape } from '@/lib/onboarding/etapes';
import type { EtatEtape } from '@/services/onboarding';

/**
 * Rail de progression, colonne gauche de la carte de démarrage.
 *
 * Il remplace le bouton « Retour » des maquettes, qui serait ici mensonger :
 * chaque étape écrit en base au moment où elle est validée, et l'activation
 * d'un cycle est définitive. Montrer ce qui a été fait, avec son résumé, est
 * l'équivalent honnête d'une navigation arrière — on consulte, on ne défait
 * pas.
 */
export function RailEtapes({
  definitions,
  etats,
  etapeCourante,
  resumes,
}: {
  definitions: DefinitionEtape[];
  etats: Map<IdEtape, EtatEtape>;
  etapeCourante: IdEtape | null;
  resumes: Partial<Record<IdEtape, string>>;
}) {
  return (
    <ol className="flex flex-col">
      {definitions.map((definition, index) => {
        const etat = etats.get(definition.id);
        const faite = etat?.faite ?? false;
        const ignoree = etat?.ignoree ?? false;
        const courante = definition.id === etapeCourante;
        const dernier = index === definitions.length - 1;

        return (
          <li key={definition.id} className="flex gap-3">
            {/* Pastille + trait de liaison, comme la colonne de gauche des
                maquettes : la ligne matérialise la continuité du parcours. */}
            <div className="flex flex-col items-center">
              <span
                aria-hidden
                className={cn(
                  'grid h-7 w-7 shrink-0 place-items-center rounded-full border text-[11px] font-semibold transition-colors',
                  faite && 'border-tertiary bg-tertiary text-white',
                  ignoree && 'border-outline-variant bg-surface-container text-text-secondary',
                  courante && 'border-primary-container bg-primary-container text-white',
                  !faite && !ignoree && !courante &&
                    'border-surface-border bg-surface-container-lowest text-text-secondary',
                )}
              >
                {faite ? (
                  <Check className="h-3.5 w-3.5" />
                ) : ignoree ? (
                  <SkipForward className="h-3 w-3" />
                ) : (
                  index + 1
                )}
              </span>
              {!dernier && (
                <span
                  aria-hidden
                  className={cn(
                    'w-px flex-1 transition-colors',
                    faite ? 'bg-tertiary/40' : 'bg-surface-border',
                  )}
                />
              )}
            </div>

            <div className={cn('min-w-0 flex-1', dernier ? 'pb-0' : 'pb-5')}>
              <p
                className={cn(
                  'text-body-sm font-medium',
                  courante ? 'text-primary-container' : 'text-text-primary',
                )}
              >
                {definition.titre}
              </p>
              <p className="mt-0.5 truncate text-body-sm text-text-secondary">
                {ignoree
                  ? 'Étape passée'
                  : faite
                    ? (resumes[definition.id] ?? 'Fait')
                    : courante
                      ? 'En cours'
                      : definition.facultative
                        ? 'Facultative'
                        : 'À venir'}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

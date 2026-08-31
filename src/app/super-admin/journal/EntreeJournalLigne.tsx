'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { EntreeJournal } from '@/services/plateforme';

/**
 * Une ligne du journal, dépliable.
 *
 * Les valeurs avant/après sont repliées par défaut. Elles peuvent contenir des
 * données d'école — c'est le prix d'un audit qui sert à quelque chose — et les
 * afficher d'office transformerait un écran de supervision en déversoir de
 * données de tenant. On les ouvre quand on enquête, pas en passant.
 */

/** Modules porteurs d'un enjeu financier ou de sécurité, signalés d'un ton. */
const TON_MODULE: Record<string, 'warning' | 'primary' | 'neutral'> = {
  finance: 'warning',
  saas: 'warning',
  authentification: 'primary',
  identity: 'primary',
};

function formatValeur(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  try {
    const texte = JSON.stringify(v, null, 2);
    return texte === '{}' ? null : texte;
  } catch {
    return null;
  }
}

export function EntreeJournalLigne({ entree }: { entree: EntreeJournal }) {
  const [ouverte, setOuverte] = React.useState(false);
  const avant = formatValeur(entree.ancienneValeur);
  const apres = formatValeur(entree.nouvelleValeur);
  const depliable = avant !== null || apres !== null;

  return (
    <li className="border-b border-surface-border/60 last:border-0">
      <div
        className={cn(
          'flex items-start gap-3 px-5 py-3',
          depliable && 'cursor-pointer hover:bg-surface-container-low',
        )}
        onClick={depliable ? () => setOuverte((o) => !o) : undefined}
        role={depliable ? 'button' : undefined}
        tabIndex={depliable ? 0 : undefined}
        onKeyDown={
          depliable
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setOuverte((o) => !o);
                }
              }
            : undefined
        }
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-body-sm font-medium text-text-primary" data-mono>
              {entree.action}
            </span>
            <Badge shape="pill" variant={TON_MODULE[entree.module] ?? 'neutral'}>
              {entree.module}
            </Badge>
          </div>
          <p className="mt-0.5 text-body-sm text-text-secondary">
            {entree.auteur ?? 'système'}
            {entree.etablissementNom && ` · ${entree.etablissementNom}`}
            {` · ${entree.objetType}`}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="text-body-sm text-text-secondary" data-mono>
            {new Date(entree.date).toLocaleString('fr-FR', {
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          {depliable && (
            <ChevronDown
              className={cn(
                'h-4 w-4 text-text-secondary transition-transform',
                ouverte && 'rotate-180',
              )}
              aria-hidden
            />
          )}
        </div>
      </div>

      {ouverte && (
        <div className="grid grid-cols-1 gap-3 border-t border-surface-border/60 bg-surface-container-low px-5 py-4 md:grid-cols-2">
          {avant && (
            <div>
              <p className="mb-1 text-label-md uppercase tracking-wide text-text-secondary">
                Avant
              </p>
              <pre className="overflow-x-auto rounded border border-surface-border bg-surface-container-lowest p-3 text-[11px] leading-relaxed text-text-secondary">
                {avant}
              </pre>
            </div>
          )}
          {apres && (
            <div>
              <p className="mb-1 text-label-md uppercase tracking-wide text-text-secondary">
                Après
              </p>
              <pre className="overflow-x-auto rounded border border-surface-border bg-surface-container-lowest p-3 text-[11px] leading-relaxed text-text-secondary">
                {apres}
              </pre>
            </div>
          )}
          {entree.objetId && (
            <p className="text-body-sm text-text-secondary md:col-span-2" data-mono>
              Objet : {entree.objetId}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

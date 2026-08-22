'use client';

import * as React from 'react';
import { Search, X } from 'lucide-react';
import { RechercheGlobale } from './RechercheGlobale';

/**
 * Sous `sm`, la barre de recherche pleine largeur n'a pas la place à côté des
 * icônes d'action et de l'avatar : elle se réduit à une icône qui ouvre un
 * bandeau de recherche plein-écran au tap.
 */
export function HeaderRecherche() {
  const [ouvert, setOuvert] = React.useState(false);

  return (
    <>
      <div className="hidden w-full max-w-md sm:block">
        <RechercheGlobale />
      </div>

      <button
        type="button"
        onClick={() => setOuvert(true)}
        aria-label="Rechercher"
        className="grid h-9 w-9 place-items-center rounded text-text-secondary transition-colors hover:bg-surface-container-high hover:text-text-primary sm:hidden"
      >
        <Search className="h-[18px] w-[18px]" aria-hidden />
      </button>

      {ouvert && (
        <div className="fixed inset-0 z-40 flex items-start gap-2 bg-surface-container-low px-gutter py-3 sm:hidden">
          <div className="flex-1">
            <RechercheGlobale />
          </div>
          <button
            type="button"
            onClick={() => setOuvert(false)}
            aria-label="Fermer la recherche"
            className="grid h-9 w-9 shrink-0 place-items-center rounded text-text-secondary transition-colors hover:bg-surface-container-high hover:text-text-primary"
          >
            <X className="h-[18px] w-[18px]" aria-hidden />
          </button>
        </div>
      )}
    </>
  );
}

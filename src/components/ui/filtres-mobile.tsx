'use client';

import * as React from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from './dialog';

/**
 * Sur une liste avec plusieurs filtres (statut, année, classe…), les afficher
 * en ligne à côté de la recherche prenait jusqu'aux trois quarts de l'écran
 * sur un téléphone avant même d'atteindre la liste. Sous `md`, ils se
 * regroupent derrière une icône « Filtres » qui ouvre une feuille ; le
 * badge affiche combien sont actifs pour ne pas les rendre invisibles.
 */
/**
 * Remplace par `BarreListe` (`src/components/ui/barre-liste.tsx`), qui porte
 * desormais l'en-tete commune des listes : recherche, filtres, tri, actions.
 * Conserve tant que des branches en cours l'importent — les supprimer ferait
 * echouer leur merge, pas la compilation de celle-ci.
 */
export function FiltresMobile({
  nombreActifs = 0,
  children,
}: {
  nombreActifs?: number;
  children: React.ReactNode;
}) {
  const [ouvert, setOuvert] = React.useState(false);

  return (
    <>
      <div className="hidden md:contents">{children}</div>

      <button
        type="button"
        onClick={() => setOuvert(true)}
        aria-label={
          nombreActifs > 0 ? `Filtres (${nombreActifs} actif${nombreActifs > 1 ? 's' : ''})` : 'Filtres'
        }
        className="relative grid h-10 shrink-0 place-items-center rounded-lg border border-surface-border bg-surface-container-lowest px-3 text-on-surface-variant shadow-sm transition-colors hover:bg-surface-container-low active:bg-surface-container-high md:hidden"
      >
        <SlidersHorizontal className="h-5 w-5" aria-hidden />
        {nombreActifs > 0 && (
          <span className="absolute -right-1.5 -top-1.5 grid h-4 w-4 place-items-center rounded-full bg-primary-container text-[10px] font-bold text-white">
            {nombreActifs}
          </span>
        )}
      </button>

      <Dialog open={ouvert} onOpenChange={setOuvert}>
        <DialogContent className="md:hidden">
          <DialogHeader>
            <DialogTitle>Filtres</DialogTitle>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-4">{children}</DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
}

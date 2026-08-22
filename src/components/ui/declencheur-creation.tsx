'use client';

import * as React from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, type ButtonProps } from './button';

/**
 * Déclencheur d'une action de création sur une page de liste : bouton libellé
 * sur desktop, bouton flottant (FAB) au-dessus de la barre de navigation sur
 * mobile — aligné sur `BoutonFlottant` des listes qui mènent à une page, mais
 * pilotable par `onClick` pour ouvrir un modal.
 *
 * Source unique du FAB de création : `FormulaireModal` et les modals « maison »
 * s'appuient tous dessus, pour un rendu identique partout.
 */
export function DeclencheurCreation({
  libelle,
  onClick,
  variant = 'primary',
  size = 'sm',
  icone,
}: {
  libelle: string;
  onClick: () => void;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  icone?: React.ReactNode;
}) {
  return (
    <>
      <Button variant={variant} size={size} onClick={onClick} className="max-md:hidden">
        {icone ?? <Plus className="h-4 w-4" aria-hidden />}
        {libelle}
      </Button>

      <button
        type="button"
        onClick={onClick}
        aria-label={libelle}
        title={libelle}
        className={cn(
          // Au-dessus de la barre de navigation : 56px de hauteur, 24px de
          // décalage du bord, 16px de gouttière, plus l'encoche.
          'fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] right-4 z-30 md:hidden',
          'grid h-14 w-14 place-items-center rounded-2xl',
          'bg-primary-container text-white shadow-lg transition-all duration-200',
          'hover:bg-primary active:scale-95',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container/50 focus-visible:ring-offset-2',
        )}
      >
        {icone ?? <Plus className="h-6 w-6" aria-hidden />}
      </button>
    </>
  );
}

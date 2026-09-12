import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
  /**
   * Rangees compactes. La console de plateforme affiche des inventaires longs
   * que l'espacement par defaut etirait sur plusieurs ecrans — elle s'ecrivait
   * donc en `<table>` brut, avec ses propres classes, et le produit avait deux
   * styles de tableau. La densite est une option, pas un autre composant :
   * l'en-tete, les etats de survol et les bordures restent communs.
   */
  dense?: boolean;
}

export const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className, dense, ...props }, ref) => (
    <div className="overflow-x-auto">
      <table
        ref={ref}
        className={cn(
          'w-full border-collapse text-left',
          // Cible les cellules depuis la table : la densite se declare a un
          // seul endroit plutot que sur chaque `TableHead` et `TableCell`.
          dense && '[&_td]:px-3 [&_td]:py-2 [&_th]:px-3 [&_th]:py-2',
          className,
        )}
        {...props}
      />
    </div>
  ),
);
Table.displayName = 'Table';

export const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn('border-b border-surface-border bg-surface-container-low', className)}
    {...props}
  />
));
TableHeader.displayName = 'TableHeader';

export const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn('divide-y divide-surface-border text-body-sm text-text-primary', className)}
    {...props}
  />
));
TableBody.displayName = 'TableBody';

/**
 * Ligne de tableau.
 *
 * Le survol etait un lavis bleu (`primary-fixed/40`). Sur un inventaire de
 * quarante lignes que l'on parcourt a la souris, une teinte de marque qui
 * s'allume a chaque ligne survolee tire l'oeil sans rien signifier : le bleu
 * du systeme veut dire « selection » ou « lien », pas « le curseur est ici ».
 * Un neutre franc situe le curseur et laisse la couleur aux etats qui la
 * meritent — les pastilles de statut, les liens.
 *
 * La bordure basse est retiree : `TableBody` porte deja `divide-y`, les deux
 * dessinaient le meme trait au meme endroit.
 */
export const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn('transition-colors hover:bg-surface-container/50', className)}
    {...props}
  />
));
TableRow.displayName = 'TableRow';

export const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      'whitespace-nowrap px-6 py-4 text-console-eyebrow uppercase text-text-secondary',
      className,
    )}
    {...props}
  />
));
TableHead.displayName = 'TableHead';

export const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td ref={ref} className={cn('px-6 py-4 text-body-md text-text-primary', className)} {...props} />
));
TableCell.displayName = 'TableCell';

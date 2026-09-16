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
 *
 * ## Une ligne qui mene quelque part se clique en entier
 *
 * Sur telephone, la carte de liste est deja un lien plein
 * (`LigneCarteMobile` : `<Link className="block">`). Le tableau, lui, ne
 * reagissait qu'au nom : une bande de pres de mille pixels dont quelques
 * dizaines seulement etaient cliquables, sans rien qui distingue le reste de la
 * ligne d'une zone morte.
 *
 * Un `<a>` ne peut pas envelopper un `<tr>`. Le motif est donc le recouvrement
 * absolu, en trois morceaux qui ne valent qu'ensemble :
 *
 * 1. la ligne porte `group relative` — c'est elle qui doit etre le bloc
 *    contenant, et non la cellule ; ancre sur la cellule, le recouvrement ne
 *    couvre que la premiere colonne, ce qui etait le cas sur l'inventaire des
 *    ecoles ;
 * 2. le lien deja present dans la ligne porte
 *    `after:absolute after:inset-0 after:z-10 after:content-['']` et passe ses
 *    etats de survol en `group-hover:` ;
 * 3. **toute cellule qui contient une commande** — un bouton, une case a
 *    cocher, un second lien — porte `relative z-20`, sans quoi le recouvrement
 *    la rend inerte. C'est le seul piege du motif, et il est silencieux :
 *    « Desactiver » ouvrirait la fiche au lieu de fermer le compte.
 *
 * On garde ainsi un vrai lien : navigation au clavier, adresse dans la barre
 * d'etat, clic droit et Ctrl-clic pour ouvrir a cote. Contrepartie assumee,
 * la meme que sur la carte mobile : le texte d'une ligne cliquable ne se
 * selectionne plus a la souris.
 *
 * Une ligne dont le seul lien est une **action** ne recoit pas ce traitement :
 * « Valider un paiement » sur les abonnements de la console reste un bouton,
 * la ligne n'y est pas une destination.
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

import * as React from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Actions d'une page de liste sur mobile (voir `Docs/15-Motif-liste-mobile.md`).
 *
 * Le `PageHeader` desktop aligne les actions en boutons libellés à droite du
 * titre. Sous `md` cette rangée n'a plus la place : l'action principale
 * devient un bouton flottant, les actions secondaires des icônes dans la
 * barre d'outils, à côté du filtre.
 */

export interface ActionMobileProps {
  href: string;
  /** Libellé lu par les lecteurs d'écran — le bouton n'affiche qu'une icône. */
  libelle: string;
  icone: LucideIcon;
}

/** Action principale de la page, flottante en bas à droite. */
export function BoutonFlottant({ href, libelle, icone: Icone }: ActionMobileProps) {
  return (
    <Link
      href={href}
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
      <Icone className="h-6 w-6" aria-hidden />
    </Link>
  );
}

/** Action secondaire, en icône pleine dans la barre d'outils. */
export function BoutonOutilPrincipal({ href, libelle, icone: Icone }: ActionMobileProps) {
  return (
    <Link
      href={href}
      aria-label={libelle}
      title={libelle}
      className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-primary-container bg-primary-container text-white shadow-sm transition-colors hover:bg-primary active:bg-primary md:hidden"
    >
      <Icone className="h-5 w-5" aria-hidden />
    </Link>
  );
}

/**
 * Rangée recherche + filtres + actions, au-dessus de la liste. Sur desktop
 * elle reprend la disposition existante (recherche et filtres alignés à
 * gauche) ; sous `md` elle devient la ligne compacte de la maquette.
 */
export function BarreOutilsListe({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex w-full items-center gap-2 md:flex-wrap md:gap-4 md:border-b md:border-surface-border md:p-4',
        className,
      )}
      {...props}
    />
  );
}

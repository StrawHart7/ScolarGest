'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';
import { MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ITEMS_BAS_SIDEBAR, ITEM_SUPPORT, type SidebarItem } from '@/lib/navigation';
import { ICONES } from './Sidebar';

/**
 * Barre d'onglets basse, seule navigation sous `md` (la sidebar y est
 * masquée). Elle flotte au-dessus du contenu — détachée des bords, en
 * pilule, avec un fond translucide et un flou d'arrière-plan — plutôt que
 * soudée au bas de l'écran : posée sur le contenu, elle reste lisible quand
 * une liste défile dessous.
 *
 * Trois onglets directs (les premières entrées du rôle) plus le bouton
 * « Plus », sans libellé sous les icônes. Les onglets restent dynamiques :
 * chaque rôle ne voit que des destinations qui lui sont accessibles, ce qui
 * évite les pages « votre rôle ne permet pas… ». « Plus » ouvre le reste des
 * entrées du rôle et les réglages communs.
 */
const MAX_ONGLETS_DIRECTS = 3;

/** Hauteur de la barre + son décalage du bas, à dégager sous le contenu. */
export const HAUTEUR_BOTTOM_NAV = 'calc(3.5rem + 1.5rem + env(safe-area-inset-bottom, 0px))';

function estActif(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Onglet({ actif, children }: { actif: boolean; children: React.ReactNode }) {
  return (
    // Les onglets inactifs gardent la même boîte que la pilule active,
    // transparente : sans elle, les icônes ne s'alignent plus dès qu'un
    // onglet devient actif et toute la rangée se décale.
    //
    // Cette pilule fait 36px de haut, et c'est voulu : c'est un rendu, pas une
    // cible. La zone cliquable est le `<Link>` qui l'entoure, porté à `h-full`
    // — soit les 56px de la barre. Le relevé du 2026-09-04 mesurait 81×36 sur
    // le lien lui-même, répété 141 fois : la navigation principale de toute
    // l'application était sous la cible de 44px du design system, sur chaque
    // page. Ne pas retirer `h-full` en croyant que la barre suffit.
    <span
      className={cn(
        'flex items-center justify-center rounded-full px-4 py-1.5 transition-colors',
        actif ? 'bg-secondary-container' : 'bg-transparent',
      )}
    >
      {children}
    </span>
  );
}

export function BottomNav({ items }: { items: SidebarItem[] }) {
  const pathname = usePathname();
  const [plusOuvert, setPlusOuvert] = React.useState(false);

  const principaux = items.slice(0, MAX_ONGLETS_DIRECTS);
  // « Plus » regroupe les entrées du rôle au-delà des onglets directs, plus les
  // réglages communs.
  // Le support est rattaché ici et non à `ITEMS_BAS_SIDEBAR` : sur desktop il
  // passe par la bulle flottante, qui est masquée sous `md`. Sans cette ligne,
  // il serait injoignable sur téléphone.
  const surplus: SidebarItem[] = [
    ...items.slice(MAX_ONGLETS_DIRECTS),
    ...ITEMS_BAS_SIDEBAR,
    ITEM_SUPPORT,
  ];

  if (items.length === 0) return null;

  return (
    <>
      <nav
        aria-label="Navigation principale"
        className={cn(
          'fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] left-1/2 z-40 md:hidden',
          'h-14 w-[calc(100%-48px)] max-w-md -translate-x-1/2',
          'flex items-center rounded-full border border-surface-border/60',
          'bg-surface-container-lowest/85 shadow-2xl backdrop-blur-xl',
        )}
      >
        <div className="flex h-full w-full items-center justify-around px-2">
          {principaux.map((item) => {
            const Icone = ICONES[item.icone];
            const actif = estActif(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={actif ? 'page' : undefined}
                aria-label={item.label}
                className="flex h-full min-w-0 flex-1 items-center justify-center"
              >
                <Onglet actif={actif}>
                  <Icone
                    className={cn('h-6 w-6', actif ? 'text-primary' : 'text-on-surface-variant')}
                    strokeWidth={actif ? 2.25 : 1.75}
                    aria-hidden
                  />
                </Onglet>
              </Link>
            );
          })}

          {surplus.length > 0 && (
            <button
              type="button"
              onClick={() => setPlusOuvert(true)}
              aria-haspopup="dialog"
              aria-label="Plus"
              className="flex h-full min-w-0 flex-1 items-center justify-center"
            >
              {/* « Plus » ne prend jamais l'état actif : la pilule bleue ne
                  doit apparaître que sur l'onglet de la page courante. */}
              <Onglet actif={false}>
                <MoreHorizontal
                  className="h-6 w-6 text-on-surface-variant"
                  strokeWidth={1.75}
                  aria-hidden
                />
              </Onglet>
            </button>
          )}
        </div>
      </nav>

      {surplus.length > 0 && (
        <Dialog open={plusOuvert} onOpenChange={setPlusOuvert}>
          <DialogContent className="md:hidden">
            <DialogHeader>
              <DialogTitle>Plus</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3 p-5">
              {surplus.map((item) => {
                const Icone = ICONES[item.icone];
                const actif = estActif(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setPlusOuvert(false)}
                    className={cn(
                      'flex min-h-[--spacing-row-standard] flex-col items-center justify-center gap-2 rounded-xl border p-4 text-center text-body-sm transition-colors',
                      actif
                        ? 'border-primary/30 bg-secondary-container text-primary'
                        : 'border-surface-border text-text-primary active:bg-surface-container',
                    )}
                  >
                    <Icone className="h-5 w-5" aria-hidden />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * État « sidebar repliée » (desktop uniquement). Replié = rail d'icônes seules.
 * Persisté en localStorage pour survivre aux navigations et rechargements.
 *
 * L'état initial est toujours « déplié » côté serveur comme au premier rendu
 * client (pas de mismatch d'hydratation) ; la préférence enregistrée est
 * appliquée juste après le montage.
 */
const CLE_STOCKAGE = 'scolargest.sidebar.replie';

interface CtxReplie {
  replie: boolean;
  basculer: () => void;
}

const Contexte = React.createContext<CtxReplie | null>(null);

export function SidebarCollapseProvider({ children }: { children: React.ReactNode }) {
  const [replie, setReplie] = React.useState(false);

  React.useEffect(() => {
    if (localStorage.getItem(CLE_STOCKAGE) === '1') setReplie(true);
  }, []);

  const basculer = React.useCallback(() => {
    setReplie((prec) => {
      const suivant = !prec;
      localStorage.setItem(CLE_STOCKAGE, suivant ? '1' : '0');
      return suivant;
    });
  }, []);

  React.useEffect(() => {
    function surTouche(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === '.') {
        e.preventDefault();
        basculer();
      }
    }
    window.addEventListener('keydown', surTouche);
    return () => window.removeEventListener('keydown', surTouche);
  }, [basculer]);

  const valeur = React.useMemo(() => ({ replie, basculer }), [replie, basculer]);
  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

export function useSidebarCollapse(): CtxReplie {
  const ctx = React.useContext(Contexte);
  if (!ctx) throw new Error('useSidebarCollapse hors de SidebarCollapseProvider');
  return ctx;
}

/**
 * Enveloppe du contenu : décale à gauche de la largeur de la sidebar, réduite
 * au rail quand elle est repliée. Le décalage n'existe qu'à partir de `md` (la
 * sidebar est masquée en dessous, remplacée par la barre basse).
 */
export function ContenuDecale({ children }: { children: React.ReactNode }) {
  const { replie } = useSidebarCollapse();
  return (
    <div
      className={cn(
        'transition-[padding] duration-200 ease-out',
        replie ? 'md:pl-sidebar-rail' : 'md:pl-sidebar',
      )}
    >
      {children}
    </div>
  );
}

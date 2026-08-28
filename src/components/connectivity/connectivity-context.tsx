'use client';

import * as React from 'react';

/**
 * Signal de connectivité réseau, global à l'application (voir
 * `src/components/layout/sidebar-collapse.tsx` pour le même pattern
 * Context + Provider). Contrairement à la sidebar, rien n'est persisté :
 * c'est un simple reflet de `navigator.onLine` / des événements
 * `online`/`offline` du navigateur.
 *
 * L'état initial est toujours `true` côté serveur comme au premier rendu
 * client (pas de mismatch d'hydratation) ; la valeur réelle est appliquée
 * juste après le montage.
 */
interface CtxConnectivite {
  enLigne: boolean;
}

const Contexte = React.createContext<CtxConnectivite | null>(null);

export function ConnectivityProvider({ children }: { children: React.ReactNode }) {
  const [enLigne, setEnLigne] = React.useState(true);

  React.useEffect(() => {
    setEnLigne(navigator.onLine);
    const surEnLigne = () => setEnLigne(true);
    const surHorsLigne = () => setEnLigne(false);
    window.addEventListener('online', surEnLigne);
    window.addEventListener('offline', surHorsLigne);
    return () => {
      window.removeEventListener('online', surEnLigne);
      window.removeEventListener('offline', surHorsLigne);
    };
  }, []);

  const valeur = React.useMemo(() => ({ enLigne }), [enLigne]);
  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

export function useConnectivity(): CtxConnectivite {
  const ctx = React.useContext(Contexte);
  if (!ctx) throw new Error('useConnectivity hors de ConnectivityProvider');
  return ctx;
}

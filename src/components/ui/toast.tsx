'use client';

import * as React from 'react';
import * as ToastPrimitive from '@radix-ui/react-toast';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastVariante = 'succes' | 'erreur' | 'avertissement' | 'info';

export interface ToastOptions {
  titre: string;
  description?: string;
  variante?: ToastVariante;
  /** Durée d'affichage en ms. Les erreurs restent plus longtemps par défaut. */
  duree?: number;
}

interface ToastInterne extends ToastOptions {
  id: number;
}

interface ToastApi {
  toast: (options: ToastOptions) => void;
  succes: (titre: string, description?: string) => void;
  erreur: (titre: string, description?: string) => void;
}

const ToastContext = React.createContext<ToastApi | null>(null);

/**
 * La plateforme n'avait aucun retour visuel de confirmation, de succès ou
 * d'échec : une action réussie et une action silencieusement rejetée se
 * ressemblaient. `useToast()` est le canal unique pour ces retours.
 */
export function useToast(): ToastApi {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error('useToast doit être utilisé à l’intérieur de <ToastProvider>');
  return ctx;
}

const STYLES: Record<ToastVariante, { bordure: string; icone: React.ReactNode }> = {
  succes: {
    bordure: 'border-l-4 border-l-tertiary-container',
    icone: <CheckCircle2 className="h-5 w-5 text-tertiary-container" aria-hidden />,
  },
  erreur: {
    bordure: 'border-l-4 border-l-error',
    icone: <XCircle className="h-5 w-5 text-error" aria-hidden />,
  },
  avertissement: {
    bordure: 'border-l-4 border-l-[#b45309]',
    icone: <AlertTriangle className="h-5 w-5 text-[#b45309]" aria-hidden />,
  },
  info: {
    bordure: 'border-l-4 border-l-primary-container',
    icone: <Info className="h-5 w-5 text-primary-container" aria-hidden />,
  },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastInterne[]>([]);
  const compteur = React.useRef(0);

  const api = React.useMemo<ToastApi>(() => {
    const toast = (options: ToastOptions) => {
      compteur.current += 1;
      const id = compteur.current;
      setToasts((precedents) => [...precedents, { ...options, id }]);
    };
    return {
      toast,
      succes: (titre, description) => toast({ titre, description, variante: 'succes' }),
      erreur: (titre, description) => toast({ titre, description, variante: 'erreur' }),
    };
  }, []);

  const retirer = React.useCallback((id: number) => {
    setToasts((precedents) => precedents.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={api}>
      <ToastPrimitive.Provider swipeDirection="right">
        {children}
        {toasts.map((t) => {
          const variante = t.variante ?? 'info';
          const style = STYLES[variante];
          return (
            <ToastPrimitive.Root
              key={t.id}
              duration={t.duree ?? (variante === 'erreur' ? 8000 : 4500)}
              onOpenChange={(ouvert) => {
                if (!ouvert) retirer(t.id);
              }}
              className={cn(
                'flex items-start gap-3 rounded-lg border border-surface-border bg-surface-container-lowest p-4 shadow-floating',
                'data-[state=open]:animate-toast-in data-[state=closed]:animate-fade-out',
                'data-[swipe=end]:animate-fade-out',
                style.bordure,
              )}
            >
              <span className="mt-0.5 shrink-0">{style.icone}</span>
              <div className="min-w-0 flex-1">
                <ToastPrimitive.Title className="text-body-md font-semibold text-text-primary">
                  {t.titre}
                </ToastPrimitive.Title>
                {t.description && (
                  <ToastPrimitive.Description className="mt-0.5 text-body-sm text-text-secondary">
                    {t.description}
                  </ToastPrimitive.Description>
                )}
              </div>
              <ToastPrimitive.Close
                aria-label="Fermer"
                className="shrink-0 rounded p-0.5 text-text-secondary transition-colors hover:bg-surface-container hover:text-text-primary"
              >
                <X className="h-4 w-4" aria-hidden />
              </ToastPrimitive.Close>
            </ToastPrimitive.Root>
          );
        })}
        <ToastPrimitive.Viewport className="fixed bottom-0 right-0 z-[60] flex w-full max-w-sm flex-col gap-2 p-4 outline-none" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}

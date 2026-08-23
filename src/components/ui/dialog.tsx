'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Lorsque le clavier virtuel s'ouvre sur mobile, la hauteur du visual viewport
 * diminue mais `window.innerHeight` reste fixe. Ce hook retourne la hauteur du
 * clavier (0 si absent ou sur desktop) pour pouvoir décaler la bottom sheet.
 */
function useKeyboardOffset() {
  const [offset, setOffset] = React.useState(0);
  React.useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setOffset(kb);
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);
  return offset;
}

/**
 * Modal flottant réutilisable. Sert de base aux formulaires « nouveau X »
 * (qui étaient des pages dédiées), à la saisie du PIN et aux confirmations
 * d'action irréversible.
 */
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-on-surface/40 backdrop-blur-[2px]',
      'data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out',
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = 'DialogOverlay';

export interface DialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  /** Largeur maximale du modal à partir de `sm`. `md` par défaut. */
  taille?: 'sm' | 'md' | 'lg';
  /** Masque la croix de fermeture (confirmation bloquante). */
  sansFermeture?: boolean;
}

// Sous `sm`, une boîte flottante centrée réduit encore plus l'espace déjà
// contraint d'un téléphone : le modal s'ancre au bord bas en pleine largeur,
// comme une feuille, et redevient une boîte centrée à partir de `sm`.
const TAILLES: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-3xl',
};

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, taille = 'md', sansFermeture, ...props }, ref) => {
  const keyboardOffset = useKeyboardOffset();
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          // Mobile : feuille ancrée en bas, remonte quand le clavier s'ouvre
          'fixed inset-x-0 bottom-0 top-auto z-50 max-h-[85dvh] w-full overflow-y-auto rounded-t-xl',
          'border-t border-surface-border bg-surface-container-lowest shadow-premium focus:outline-none',
          'data-[state=open]:animate-slide-up data-[state=closed]:animate-fade-out',
          // Desktop : boîte centrée, inchangée
          'sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:max-h-[calc(100vh-4rem)]',
          'sm:w-[calc(100vw-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg sm:border',
          'sm:data-[state=open]:animate-dialog-in',
          TAILLES[taille],
          className,
        )}
        // Décale le modal vers le haut quand le clavier virtuel apparaît.
        // L'inline style ne s'applique qu'en mobile (sur desktop keyboardOffset
        // reste 0 car le visual viewport ne rétrécit pas).
        style={keyboardOffset > 0 ? { bottom: keyboardOffset } : undefined}
        {...props}
      >
        {children}
        {!sansFermeture && (
          <DialogPrimitive.Close
            className="absolute right-4 top-4 rounded p-1 text-text-secondary transition-colors hover:bg-surface-container hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container/40"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" aria-hidden />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
});
DialogContent.displayName = 'DialogContent';

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('space-y-1 border-b border-surface-border px-6 py-4 pr-12', className)}
      {...props}
    />
  );
}

export function DialogBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('space-y-4 px-6 py-5', className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-end gap-2 border-t border-surface-border bg-surface-container-low px-6 py-3',
        className,
      )}
      {...props}
    />
  );
}

export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-headline-md text-text-primary', className)}
    {...props}
  />
));
DialogTitle.displayName = 'DialogTitle';

export const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-body-sm text-text-secondary', className)}
    {...props}
  />
));
DialogDescription.displayName = 'DialogDescription';

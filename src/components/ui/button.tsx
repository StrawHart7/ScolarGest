'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { useFormStatus } from 'react-dom';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Spinner } from './spinner';

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 rounded-lg font-medium',
    'transition-[background-color,border-color,color,box-shadow,transform] duration-150',
    'active:scale-[0.98]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container/50 focus-visible:ring-offset-1',
    'disabled:pointer-events-none disabled:opacity-50',
  ].join(' '),
  {
    variants: {
      variant: {
        // `text-white` seul ne suffisait pas : hérité puis écrasé par la
        // couleur de texte du conteneur sur les boutons rendus via `asChild`
        // (Link/anchor), le libellé ressortait en noir sur le bleu et sur le
        // rouge. On force la couleur, y compris sur l'enfant slotté.
        primary:
          '!text-white bg-primary-container hover:bg-primary active:bg-primary shadow-subtle hover:shadow-floating [&_*]:!text-white',
        secondary:
          'border border-surface-border bg-surface-container-lowest text-primary-container hover:border-primary-container/50 hover:bg-primary-fixed/60 active:bg-primary-fixed',
        ghost:
          'bg-transparent text-text-primary hover:bg-surface-container active:bg-surface-container-high',
        destructive:
          '!text-white bg-error hover:bg-error-on-container active:bg-error-on-container shadow-subtle [&_*]:!text-white',
        tertiary:
          '!text-white bg-tertiary-container hover:bg-tertiary active:bg-tertiary shadow-subtle [&_*]:!text-white',
      },
      size: {
        sm: 'h-8 px-3 text-body-sm',
        md: 'h-10 px-4 text-body-md',
        lg: 'h-11 px-6 text-body-md',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** Affiche un spinner et désactive le bouton. */
  chargement?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, chargement, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        disabled={asChild ? undefined : disabled || chargement}
        aria-busy={chargement || undefined}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {chargement && <Spinner />}
            {children}
          </>
        )}
      </Comp>
    );
  },
);
Button.displayName = 'Button';

/**
 * Bouton de soumission qui se met tout seul en attente pendant l'exécution de
 * la Server Action du formulaire. Sans lui, l'utilisateur reste 3 à 6 s devant
 * un écran identique et reclique, ce qui déclenche l'action deux fois.
 */
export const SubmitButton = React.forwardRef<
  HTMLButtonElement,
  Omit<ButtonProps, 'chargement' | 'asChild' | 'type'> & { libelleEnCours?: string }
>(({ children, libelleEnCours, ...props }, ref) => {
  const { pending } = useFormStatus();
  return (
    <Button ref={ref} type="submit" chargement={pending} {...props}>
      {pending && libelleEnCours ? libelleEnCours : children}
    </Button>
  );
});
SubmitButton.displayName = 'SubmitButton';

export { buttonVariants };

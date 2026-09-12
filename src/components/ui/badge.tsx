import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Pastille de statut.
 *
 * **La bordure de la pilule etait teintee en theorie et grise en fait.** Le
 * `shape` portait `border-current/15`, or Tailwind 3 ne sait pas appliquer une
 * opacite a `currentColor` : la classe n'est generee pour aucune valeur. Seule
 * la largeur `border` sortait, et la couleur retombait sur la regle globale
 * `* { border-color: var(--color-surface-border) }` de `globals.css`. Une
 * pilule « Suspendue » portait donc un liseré gris quand tout le reste de sa
 * surface disait rouge.
 *
 * La bordure descend donc dans `variant`, ou la teinte est connue et peut
 * porter une opacite. `shape` ne garde que la forme — ce qu'il dit.
 *
 * Le corps de la pilule passe par `console-eyebrow` au lieu d'un `text-[11px]`
 * ecrit en dur : meme taille, mais dans l'echelle, et la meme voix que les
 * intitules de carte et les en-tetes de tableau.
 */
const badgeVariants = cva('inline-flex items-center font-semibold', {
  variants: {
    variant: {
      neutral: 'bg-surface-container text-text-secondary border-outline/25',
      primary: 'bg-primary-container/10 text-primary-container border-primary-container/25',
      success: 'bg-tertiary/10 text-tertiary border-tertiary/25',
      warning: 'bg-warning/10 text-warning-on-container border-warning-on-container/25',
      error: 'bg-error/10 text-error border-error/25',
    },
    shape: {
      tag: 'rounded px-2 py-0.5 text-label-md',
      pill: 'rounded-full border px-2.5 py-0.5 text-console-eyebrow',
    },
  },
  defaultVariants: { variant: 'neutral', shape: 'tag' },
});

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, shape, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, shape }), className)} {...props} />;
}

import * as React from 'react';
import { cn } from '@/lib/utils';

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

/**
 * Zone de texte multiligne.
 *
 * Elle n'existait pas : cinq ecrans repetaient la meme chaine de classes a la
 * main (support, demande de demo, approbation, soumission, reponse du
 * support). Une chaine recopiee cinq fois derive a la premiere retouche — et
 * elle avait deja derive, un `flex w-full` ici, un `w-full` la.
 *
 * Meme bordure, meme rayon et meme anneau de focus que `Input` : dans un
 * formulaire, un champ court et un champ long doivent se ressembler.
 */
export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, rows = 4, ...props }, ref) => (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        'flex w-full rounded-lg border border-surface-border bg-surface-container-lowest px-3 py-2 text-body-md text-text-primary',
        'placeholder:text-text-secondary/60',
        'transition-colors hover:border-outline-variant',
        'focus-visible:border-primary-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container/20',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';

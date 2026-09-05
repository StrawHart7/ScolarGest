'use client';

import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cn } from '@/lib/utils';

export const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(
      // Casse normale, pas de capitales.
      //
      // `label-md uppercase tracking-wide` vient de `DESIGN.md`, ou il designe
      // les **en-tetes de colonnes** d'un tableau de donnees. Applique aux
      // etiquettes de champ, il crie : sur le formulaire de creation d'eleve,
      // « PRENOMS », « TELEPHONE », « PROFESSION » avaient presque le poids
      // visuel de la valeur qu'ils annoncent, et chaque champ coutait 16px de
      // hauteur de plus. Le releve du 2026-09-04 mesurait ce formulaire a
      // 2 008px sur telephone.
      //
      // 13px semi-gras en casse normale : l'etiquette reste identifiable comme
      // etiquette, sans disputer la vedette a la donnee. Les en-tetes de
      // tableau gardent `label-md uppercase`, qui est leur usage d'origine.
      'text-touch-label text-text-secondary',
      className,
    )}
    {...props}
  />
));
Label.displayName = 'Label';

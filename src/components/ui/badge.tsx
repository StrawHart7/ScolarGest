import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva('inline-flex items-center font-semibold', {
  variants: {
    variant: {
      neutral: 'bg-surface-container text-text-secondary',
      primary: 'bg-primary-container/10 text-primary-container',
      success: 'bg-tertiary/10 text-tertiary',
      warning: 'bg-amber-500/10 text-amber-700',
      error: 'bg-error/10 text-error',
    },
    shape: {
      tag: 'rounded px-2 py-0.5 text-label-md',
      pill: 'rounded-full border border-current/15 px-2.5 py-0.5 text-[11px] tracking-wide',
    },
  },
  defaultVariants: { variant: 'neutral', shape: 'tag' },
});

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, shape, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, shape }), className)} {...props} />;
}

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded px-2 py-0.5 text-label-md font-semibold',
  {
    variants: {
      variant: {
        neutral: 'bg-surface-container text-text-secondary',
        primary: 'bg-primary-container/10 text-primary-container',
        success: 'bg-tertiary/10 text-tertiary',
        warning: 'bg-amber-500/10 text-amber-700',
        error: 'bg-error/10 text-error',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

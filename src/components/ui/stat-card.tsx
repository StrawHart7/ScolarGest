import * as React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  trend?: { label: string; direction: 'up' | 'down' | 'flat' };
  mono?: boolean;
  className?: string;
}

const TREND_ICON = { up: TrendingUp, down: TrendingDown, flat: Minus };
const TREND_COLOR = {
  up: 'text-tertiary',
  down: 'text-error',
  flat: 'text-text-secondary',
};

export function StatCard({ label, value, icon, trend, mono, className }: StatCardProps) {
  const TrendIcon = trend ? TREND_ICON[trend.direction] : null;

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl border border-surface-border bg-surface-container-lowest transition-shadow hover:shadow-subtle',
        className,
      )}
    >
      {/* Mobile : ligne horizontale compacte — icône + label/valeur */}
      <div className="flex items-center gap-3 p-3 md:hidden">
        <span className="shrink-0 rounded-lg bg-primary/10 p-2 text-primary">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] font-medium uppercase tracking-wider text-text-secondary">
            {label}
          </p>
          <p
            className={cn(
              'text-[15px] font-bold leading-tight text-primary',
              mono && 'font-mono',
            )}
            data-mono={mono || undefined}
          >
            {value}
          </p>
          {trend && TrendIcon && (
            <div className={cn('mt-0.5 flex items-center gap-1', TREND_COLOR[trend.direction])}>
              <TrendIcon className="h-3 w-3" aria-hidden />
              <span className="text-[10px]">{trend.label}</span>
            </div>
          )}
        </div>
      </div>

      {/* Desktop : carte verticale h-32 — inchangée */}
      <div className="hidden h-32 flex-col justify-between p-5 md:flex">
        <div className="flex items-start justify-between">
          <span className="text-label-md uppercase tracking-wider text-text-secondary">
            {label}
          </span>
          <span className="text-primary/50">{icon}</span>
        </div>
        <div>
          <div
            className={cn('text-display-sm text-primary', mono && 'font-mono text-[24px]')}
            data-mono={mono || undefined}
          >
            {value}
          </div>
          {trend && TrendIcon && (
            <div className={cn('mt-1 flex items-center gap-1', TREND_COLOR[trend.direction])}>
              <TrendIcon className="h-3.5 w-3.5" aria-hidden />
              <span className="text-label-md">{trend.label}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

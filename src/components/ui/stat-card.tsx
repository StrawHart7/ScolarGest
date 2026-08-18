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
        'group relative flex h-32 flex-col justify-between overflow-hidden rounded-xl border border-surface-border bg-surface-container-lowest p-5 transition-shadow hover:shadow-subtle',
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <span className="text-label-md uppercase tracking-wider text-text-secondary">{label}</span>
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
  );
}

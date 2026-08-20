import { cn } from '@/lib/utils';

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn('animate-pulse rounded bg-surface-container', className)}
      {...props}
    />
  );
}

/**
 * Squelette de tableau utilisé par les `loading.tsx` des routes qui affichent
 * une liste : un aller-retour Supabase prend plusieurs secondes et laissait
 * jusqu'ici l'écran figé sans aucun signe d'activité.
 */
export function TableSkeleton({ colonnes = 5, lignes = 8 }: { colonnes?: number; lignes?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-surface-border bg-surface-container-lowest">
      <div className="flex gap-4 border-b border-surface-border bg-surface-container-low px-4 py-3">
        {Array.from({ length: colonnes }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: lignes }).map((_, ligne) => (
        <div key={ligne} className="flex gap-4 border-b border-surface-border px-4 py-3 last:border-0">
          {Array.from({ length: colonnes }).map((_, colonne) => (
            <Skeleton
              key={colonne}
              className="h-3 flex-1"
              style={{ opacity: 1 - ligne * 0.07 }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton({ colonnes, lignes }: { colonnes?: number; lignes?: number }) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <TableSkeleton colonnes={colonnes} lignes={lignes} />
    </div>
  );
}

import { cn } from '@/lib/utils';

/**
 * Un balayage lumineux traverse le bloc en continu, plutôt qu'un simple
 * `animate-pulse` plat — le signal « ça charge » reste identique, juste plus
 * vivant. `overflow-hidden` + `relative` sont nécessaires au sweep interne :
 * un `className` qui les retire casserait l'effet, pas le composant.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn(
        'relative isolate overflow-hidden rounded bg-surface-container',
        className,
      )}
      {...props}
    >
      <span
        className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent"
        style={{ animationDuration: '1.6s' }}
      />
    </div>
  );
}

/**
 * Squelette de tableau utilisé par les `loading.tsx` des routes qui affichent
 * une liste : un aller-retour Supabase prend plusieurs secondes et laissait
 * jusqu'ici l'écran figé sans aucun signe d'activité.
 *
 * Sous `md`, les listes converties rendent des rangées `LigneCarteMobile`
 * (avatar + deux lignes de texte), pas un tableau — garder le squelette en
 * lignes larges y produisait un décalage de mise en page visible au moment
 * où les vraies données arrivaient (tableau qui se change en cartes sous les
 * yeux). Le squelette prend donc la même forme que ce qu'il annonce : cartes
 * sous `md`, tableau au-delà.
 */
export function TableSkeleton({ colonnes = 5, lignes = 8 }: { colonnes?: number; lignes?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-surface-border bg-surface-container-lowest">
      <div className="hidden md:block">
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

      <div className="divide-y divide-surface-border md:hidden">
        {Array.from({ length: lignes }).map((_, ligne) => (
          <div key={ligne} className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="h-10 w-10 shrink-0 rounded-full" style={{ opacity: 1 - ligne * 0.07 }} />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3 w-2/3" style={{ opacity: 1 - ligne * 0.07 }} />
              <Skeleton className="h-2.5 w-1/3" style={{ opacity: 1 - ligne * 0.07 }} />
            </div>
            <Skeleton className="h-5 w-14 shrink-0 rounded-full" style={{ opacity: 1 - ligne * 0.07 }} />
          </div>
        ))}
      </div>
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

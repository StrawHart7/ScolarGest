import { GraduationCap } from 'lucide-react';

/**
 * Écran de chargement plein cadre pour les frontières `loading.tsx` de haut
 * niveau (racine, groupes de segments) — celles qu'un utilisateur voit au
 * tout premier chargement, pas les listes internes qui ont leur propre
 * squelette (`PageSkeleton`). La marque respire pendant que la page suivante
 * se prépare, plutôt qu'un écran vide ou un spinner générique.
 */
export function BrandedLoader() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="grid min-h-screen place-items-center bg-surface"
    >
      <span className="sr-only">Chargement de ScolarGest…</span>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute left-1/2 top-1/2 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-container/[0.07] blur-3xl" />
      </div>

      <div className="relative flex flex-col items-center gap-5">
        <div className="relative grid h-20 w-20 place-items-center">
          <span className="absolute inset-0 rounded-full border border-primary-container/40 animate-ring-pulse" />
          <span
            className="absolute inset-0 rounded-full border border-primary-container/40 animate-ring-pulse"
            style={{ animationDelay: '0.7s' }}
          />
          <span className="grid h-14 w-14 place-items-center rounded-full bg-primary-container text-white shadow-glow animate-mark-breathe">
            <GraduationCap className="h-7 w-7" aria-hidden />
          </span>
        </div>

        <span className="text-headline-md font-bold tracking-tight text-primary-container">
          ScolarGest
        </span>

        <div className="h-1 w-40 overflow-hidden rounded-full bg-surface-container">
          <div
            className="h-full w-full animate-loader-sweep rounded-full"
            style={{
              backgroundImage:
                'linear-gradient(90deg, transparent 0%, transparent 35%, #0052cc 50%, transparent 65%, transparent 100%)',
              backgroundSize: '200% 100%',
            }}
          />
        </div>
      </div>
    </div>
  );
}

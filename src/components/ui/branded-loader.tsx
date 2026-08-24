import { GraduationCap } from 'lucide-react';

/**
 * Écran de chargement de la marque — c'est ce que `loading.tsx` affiche
 * pour TOUTE frontière de route de l'application (racine et chaque segment,
 * jusqu'aux pages imbriquées) : Next.js le monte à la place du contenu tant
 * que le Server Component de la page n'a pas fini de résoudre ses données.
 * Avant ce composant, ces ~50 frontières rendaient un simple squelette de
 * tableau gris (`PageSkeleton`) — correct mais interchangeable avec
 * n'importe quel produit. Celui-ci porte la marque.
 */
export function BrandedLoader() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="relative grid min-h-dvh place-items-center overflow-hidden bg-surface"
    >
      <span className="sr-only">Chargement de ScolarGest…</span>

      {/* Fond : halo radial + trame de points, très estompés — la marque
          respire, le fond ne doit jamais rivaliser avec elle. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/2 h-[640px] w-[640px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-container/[0.08] blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.4]"
          style={{
            backgroundImage:
              'radial-gradient(circle, rgba(0,61,155,0.14) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
            maskImage: 'radial-gradient(ellipse 70% 60% at 50% 45%, black 0%, transparent 75%)',
            WebkitMaskImage:
              'radial-gradient(ellipse 70% 60% at 50% 45%, black 0%, transparent 75%)',
          }}
        />
      </div>

      <div className="relative flex flex-col items-center gap-6 animate-fade-in">
        <div className="relative grid h-24 w-24 place-items-center">
          <span className="absolute inset-0 rounded-full border border-primary-container/40 animate-ring-pulse" />
          <span
            className="absolute inset-0 rounded-full border border-primary-container/40 animate-ring-pulse"
            style={{ animationDelay: '0.7s' }}
          />
          <span
            className="absolute inset-0 rounded-full border border-primary-container/30 animate-ring-pulse"
            style={{ animationDelay: '1.4s' }}
          />
          <span className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-primary-container to-primary text-white shadow-glow animate-mark-breathe">
            <GraduationCap className="h-8 w-8" aria-hidden />
          </span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <span className="text-headline-md font-bold tracking-tight text-primary-container">
            ScolarGest
          </span>
          <span className="text-body-sm text-text-secondary">Chargement en cours…</span>
        </div>

        <div className="h-1 w-44 overflow-hidden rounded-full bg-surface-container">
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

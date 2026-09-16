import { ScolaIllustration } from '@/components/scola/illustration';

/**
 * Écran de chargement de la marque — c'est ce que `loading.tsx` affiche
 * pour TOUTE frontière de route de l'application (racine et chaque segment,
 * jusqu'aux pages imbriquées) : Next.js le monte à la place du contenu tant
 * que le Server Component de la page n'a pas fini de résoudre ses données.
 * Avant ce composant, ces ~50 frontières rendaient un simple squelette de
 * tableau gris (`PageSkeleton`) — correct mais interchangeable avec
 * n'importe quel produit. Celui-ci porte la marque.
 *
 * ## Scola y attend à la place du médaillon
 *
 * Le chapeau de diplômé dans sa pastille bleue disait « école » à quelqu'un qui
 * sait déjà quel produit il a ouvert. La mascotte, elle, occupe l'attente : son
 * état `loading` a sa propre boucle, et c'est très exactement ce qu'on demande
 * à un écran de chargement.
 *
 * Elle est posée sur le fond clair et non plus dans une pastille : en
 * `primary-container`, elle disparaîtrait sur le dégradé bleu qui s'y trouvait.
 * Les anneaux qui battent restent, ils sont ce qui donne le rythme.
 *
 * **Le SVG est rendu au serveur**, seule l'animation attend le JavaScript :
 * un chargement lent — le cas où cet écran compte — montre donc déjà la
 * mascotte au premier octet, immobile puis vivante.
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

      <div className="relative flex animate-fade-in flex-col items-center gap-6">
        <div className="relative grid h-28 w-28 place-items-center">
          <span className="animate-ring-pulse absolute inset-0 rounded-full border border-primary-container/40" />
          <span
            className="animate-ring-pulse absolute inset-0 rounded-full border border-primary-container/40"
            style={{ animationDelay: '0.7s' }}
          />
          <span
            className="animate-ring-pulse absolute inset-0 rounded-full border border-primary-container/30"
            style={{ animationDelay: '1.4s' }}
          />
          <ScolaIllustration etat="loading" taille={76} />
        </div>

        <div className="flex flex-col items-center gap-1">
          <span className="text-headline-md font-bold tracking-tight text-primary-container">
            ScolarGest
          </span>
          <span className="text-body-sm text-text-secondary">Je rassemble vos données…</span>
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

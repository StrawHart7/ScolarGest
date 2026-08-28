import { WifiOff } from 'lucide-react';
import { GraduationCap } from 'lucide-react';
import { ReessayerButton } from './ReessayerButton';

/**
 * Page de secours affichée par le service worker (public/sw.js) quand une
 * navigation échoue et qu'aucune version en cache de la page visée n'existe.
 * Doit rester statique et indépendante de l'auth/des données — elle est
 * précachée à l'installation du SW pour être disponible hors ligne dès le
 * premier chargement.
 */
export default function OfflinePage() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="relative grid min-h-dvh place-items-center overflow-hidden bg-surface px-6"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/2 h-[640px] w-[640px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-container/[0.08] blur-[120px]" />
      </div>

      <div className="relative flex max-w-sm flex-col items-center gap-6 text-center">
        <div className="relative grid h-24 w-24 place-items-center">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-primary-container to-primary text-white shadow-glow">
            <GraduationCap className="h-8 w-8" aria-hidden />
          </span>
          <span className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full border-2 border-surface bg-error text-white">
            <WifiOff className="h-4 w-4" aria-hidden />
          </span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <span className="text-headline-md font-bold tracking-tight text-primary-container">
            ScolarGest
          </span>
          <h1 className="text-display-sm text-text-primary">Vous êtes hors ligne</h1>
          <p className="text-body-sm text-text-secondary">
            Impossible de charger cette page sans connexion. Vérifiez votre réseau puis réessayez —
            les brouillons de notes non enregistrés restent conservés sur cet appareil.
          </p>
        </div>

        <ReessayerButton />
      </div>
    </div>
  );
}

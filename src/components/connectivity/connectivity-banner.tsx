'use client';

import { WifiOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useConnectivity } from './connectivity-context';

/**
 * Bannière persistante affichée tant que l'appareil est hors ligne.
 *
 * Montée à la racine (`src/app/layout.tsx`), donc visible sur toute page —
 * y compris `/login` ou la landing publique, qui ne passent pas par
 * `AppLayout`. C'est pourquoi elle n'utilise pas `useToast()` : le
 * `ToastProvider` n'est monté que dans `AppLayout`
 * (`src/components/layout/AppLayout.tsx`), pas globalement.
 */
export function ConnectivityBanner() {
  const { enLigne } = useConnectivity();
  if (enLigne) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-[70] flex justify-center p-2 animate-slide-up"
    >
      <Badge variant="error" shape="pill" className="gap-1.5 shadow-floating">
        <WifiOff className="h-3 w-3" aria-hidden />
        Hors ligne — les modifications seront synchronisées au retour du réseau
      </Badge>
    </div>
  );
}

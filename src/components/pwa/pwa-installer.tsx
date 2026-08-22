'use client';

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Événement `beforeinstallprompt` (non typé dans lib.dom pour l'instant).
 * Chrome/Edge le déclenchent quand l'app remplit les critères d'installabilité
 * (manifeste valide + service worker avec handler `fetch` + HTTPS).
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const CLE_REFUS = 'scolargest.pwa.invite-refusee';

/**
 * Enregistre le service worker et propose l'installation de la PWA.
 *
 * Les navigateurs ne déclenchent plus d'invite automatique : on capte
 * `beforeinstallprompt`, on l'empêche de se perdre, et on affiche notre propre
 * bannière. iOS/Safari n'émet pas cet événement (installation manuelle via
 * « Partager > Sur l'écran d'accueil ») — on n'affiche donc rien là-bas.
 */
export function PwaInstaller() {
  const [invite, setInvite] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if ('serviceWorker' in navigator) {
      // Après le load pour ne pas concurrencer le rendu initial.
      const enregistrer = () =>
        navigator.serviceWorker.register('/sw.js').catch(() => {
          // Un échec d'enregistrement ne doit jamais casser l'app.
        });
      if (document.readyState === 'complete') enregistrer();
      else window.addEventListener('load', enregistrer, { once: true });
    }

    const dejaInstallee = window.matchMedia('(display-mode: standalone)').matches;
    const dejaRefusee = window.localStorage.getItem(CLE_REFUS) === '1';

    const surInvite = (event: Event) => {
      event.preventDefault();
      if (dejaInstallee || dejaRefusee) return;
      setInvite(event as BeforeInstallPromptEvent);
    };
    const surInstallation = () => setInvite(null);

    window.addEventListener('beforeinstallprompt', surInvite);
    window.addEventListener('appinstalled', surInstallation);
    return () => {
      window.removeEventListener('beforeinstallprompt', surInvite);
      window.removeEventListener('appinstalled', surInstallation);
    };
  }, []);

  if (!invite) return null;

  const installer = async () => {
    await invite.prompt();
    await invite.userChoice;
    setInvite(null);
  };

  const refuser = () => {
    window.localStorage.setItem(CLE_REFUS, '1');
    setInvite(null);
  };

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-lg border border-surface-border bg-surface-container-lowest p-4 shadow-floating md:inset-x-auto md:right-4 md:left-auto">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-primary-fixed text-primary-container">
          <Download className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-body-md font-medium text-text-primary">Installer ScolarGest</p>
          <p className="mt-0.5 text-body-sm text-text-secondary">
            Ajoutez l&apos;application à votre appareil pour un accès rapide, en plein écran.
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={installer}>
              Installer
            </Button>
            <Button size="sm" variant="ghost" onClick={refuser}>
              Plus tard
            </Button>
          </div>
        </div>
        <button
          type="button"
          onClick={refuser}
          aria-label="Fermer"
          className="-mr-1 -mt-1 rounded p-1 text-text-secondary hover:bg-surface-container hover:text-text-primary"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}

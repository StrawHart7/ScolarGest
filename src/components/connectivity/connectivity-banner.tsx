'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { useConnectivity } from './connectivity-context';

/**
 * Pastille de connectivité : un point, deux mots, sous l'en-tête.
 *
 * Montée à la racine (`src/app/layout.tsx`), donc visible sur toute page —
 * y compris `/login` ou la landing publique, qui ne passent pas par
 * `AppLayout`. C'est pourquoi elle n'utilise pas `useToast()` : le
 * `ToastProvider` n'est monté que dans `AppLayout`
 * (`src/components/layout/AppLayout.tsx`), pas globalement.
 *
 * **Elle n'est plus rouge, et elle ne dit plus une phrase.** Le rendu
 * précédent était un badge `error` portant « Hors ligne — les modifications
 * seront synchronisées au retour du réseau », posé en `top-0` : sur un écran
 * de 390px la phrase tenait sur trois lignes et se superposait au logo, à la
 * cloche et à l'avatar de l'en-tête, illisible par-dessus illisible. Deux
 * fautes distinctes, corrigées ensemble.
 *
 * - **Le rouge est réservé à la faute.** Perdre le réseau dans une école de
 *   Lomé n'en est pas une, c'est l'ordinaire. `error` sur un état subi
 *   alarme sans rien proposer ; l'ardoise sombre neutre informe.
 * - **`top-header`, pas `top-0`.** La barre se pose sous l'en-tête au lieu de
 *   le recouvrir. Une notification qui masque la navigation retire à
 *   l'utilisateur le moyen d'y répondre.
 * - **Deux mots au lieu d'une phrase.** « Hors ligne » suffit à l'état ; la
 *   promesse tient dans « reconnexion automatique », qui vaut pour toutes
 *   les pages. L'ancienne formulation promettait une synchronisation
 *   générale alors que seule la saisie de notes est réellement conservée
 *   hors ligne (`src/lib/offline/notes-brouillon-db.ts`).
 *
 * **Le retour du réseau est annoncé, puis se tait.** Sans cela, la pastille
 * disparaissait sans rien dire et on ne savait pas si le réseau était revenu
 * ou si l'affichage avait lâché. Le même contenant change de point et de mot
 * pendant quatre secondes, puis s'efface de lui-même — c'est la seule façon
 * discrète de fermer l'épisode.
 */

/** Durée d'affichage du retour en ligne, avant effacement. */
const DUREE_RETOUR_MS = 4000;

/** Doit valoir `animate-banniere-out`, jouée juste avant le démontage. */
const DUREE_SORTIE_MS = 180;

export function ConnectivityBanner() {
  const { enLigne } = useConnectivity();
  const [retour, setRetour] = React.useState(false);
  const [sortant, setSortant] = React.useState(false);
  // Un onglet ouvert en ligne ne doit rien annoncer : « de retour en ligne »
  // n'a de sens que si l'on en est parti.
  const dejaHorsLigne = React.useRef(false);

  React.useEffect(() => {
    if (!enLigne) {
      dejaHorsLigne.current = true;
      setRetour(false);
      setSortant(false);
      return;
    }
    if (!dejaHorsLigne.current) return;
    dejaHorsLigne.current = false;
    setRetour(true);
    setSortant(false);
    const efface = setTimeout(() => setSortant(true), DUREE_RETOUR_MS - DUREE_SORTIE_MS);
    const demonte = setTimeout(() => setRetour(false), DUREE_RETOUR_MS);
    return () => {
      clearTimeout(efface);
      clearTimeout(demonte);
    };
  }, [enLigne]);

  if (enLigne && !retour) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-header z-[70] flex justify-center px-gutter pt-2"
    >
      <div
        className={cn(
          'flex items-center gap-2 rounded-full bg-text-primary/95 py-1.5 pl-3 pr-3.5 shadow-floating backdrop-blur-sm',
          sortant ? 'animate-banniere-out' : 'animate-banniere-in',
        )}
      >
        {/*
          Le point vaut l'icône : à 12px, un pictogramme de Wi-Fi barré n'est
          plus lisible, un point coloré l'est toujours. L'anneau ne bat que
          hors ligne — une fois revenu, plus rien ne demande l'attention.
        */}
        <span className="relative flex size-2 shrink-0">
          {!enLigne && (
            <span
              className="absolute inset-0 animate-ring-pulse rounded-full bg-warning"
              aria-hidden
            />
          )}
          <span
            className={cn(
              'relative size-2 rounded-full',
              enLigne ? 'bg-tertiary-fixed' : 'bg-warning',
            )}
          />
        </span>

        <span className="whitespace-nowrap text-touch-meta text-white">
          {enLigne ? 'De retour en ligne' : 'Hors ligne'}
          {!enLigne && <span className="text-white/55"> &middot; reconnexion automatique</span>}
        </span>
      </div>
    </div>
  );
}

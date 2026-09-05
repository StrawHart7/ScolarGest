'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Lightbulb, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  demanderConseil,
  reporterConseilAction,
  releguerConseilAction,
  suivreConseilAction,
  type ConseilAffichable,
} from './actions';

/**
 * Panneau de conseils : ce que la plateforme sait faire et que l'utilisateur
 * n'a pas encore fait.
 *
 * **Un seul conseil, et pas tout de suite.** Le panneau ne se montre qu'à
 * partir de la deuxième page de la session, après un court délai. Accueillir
 * quelqu'un par une leçon au moment où il ouvre son tableau de bord le
 * détournerait de ce qu'il venait faire ; le rythme est ce qui sépare un
 * conseil d'une publicité.
 *
 * **Trois issues, aucune définitive.** « Le faire » suit le lien — le conseil
 * disparaîtra de lui-même quand la donnée existera. « Plus tard » le rend dans
 * sept jours. « Pas pour moi » le range en fin de file : il revient lorsque
 * tout le reste est épuisé, jamais avant trente jours. Une fermeture
 * définitive punirait quelqu'un qui a seulement voulu dire « pas maintenant ».
 *
 * **Desktop uniquement**, comme la bulle de support : sous `md`, ce coin est
 * déjà pris par le bouton d'action des listes et surplombé par la barre
 * d'onglets. Le mobile passera par une bannière fine ; ce n'est pas encore
 * fait, et c'est signalé.
 */

/** Compteur de pages vues dans l'onglet. Le premier écran ne compte pas. */
const CLE_PAGES = 'scolargest.conseils.pages';

/** Délai avant apparition, une fois la page posée. */
const DELAI_MS = 6000;

function pagesVues(): number {
  try {
    const brut = sessionStorage.getItem(CLE_PAGES);
    return brut ? Number(brut) || 0 : 0;
  } catch {
    // Navigation privée, stockage refusé : on se comporte comme au premier
    // écran plutôt que de faire tomber le layout.
    return 0;
  }
}

function noterPage(n: number): void {
  try {
    sessionStorage.setItem(CLE_PAGES, String(n));
  } catch {
    /* sans conséquence */
  }
}

export function PanneauConseil({ role }: { role?: string }) {
  const pathname = usePathname();
  const [conseil, setConseil] = React.useState<ConseilAffichable | null>(null);
  const demande = React.useRef(false);

  const rolesEcole = ['DIRECTEUR', 'SECRETAIRE', 'COMPTABLE', 'ENSEIGNANT'];
  const actif = Boolean(role && rolesEcole.includes(role));

  React.useEffect(() => {
    if (!actif) return;
    const n = pagesVues() + 1;
    noterPage(n);
    // Premier écran de la session : on laisse la personne arriver.
    if (n < 2) return;
    // Le questionnaire de démarrage porte déjà sa propre pédagogie ; deux
    // guides simultanés se contrediraient.
    if (pathname.startsWith('/demarrage')) return;
    if (demande.current) return;

    const minuteur = setTimeout(() => {
      demande.current = true;
      demanderConseil(pathname)
        .then((resultat) => setConseil(resultat ?? null))
        // Une Server Action interrompue peut se résoudre sur `undefined`
        // plutôt que rejeter. Un conseil manquant est sans conséquence.
        .catch(() => setConseil(null));
    }, DELAI_MS);

    return () => clearTimeout(minuteur);
  }, [actif, pathname]);

  if (!conseil) return null;

  function fermer() {
    setConseil(null);
  }

  return (
    /*
      Au-dessus de la bulle de support, qui occupe `bottom-6 right-6`. Les deux
      cohabitent : le support est un recours, le conseil une proposition.
    */
    <div className="fixed bottom-24 right-6 z-30 hidden w-80 md:block">
      <div className="rounded-lg border border-surface-border bg-surface-container-lowest shadow-floating">
        <div className="flex items-start gap-3 p-4">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-primary-on-fixed">
            <Lightbulb className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <p className="text-body-md font-medium text-text-primary">{conseil.titre}</p>
              {conseil.nouveaute && (
                <span className="shrink-0 text-body-sm text-text-secondary">Nouveau</span>
              )}
            </div>
            <p className="mt-1 text-body-sm text-text-secondary">{conseil.texte}</p>
          </div>
          <button
            type="button"
            onClick={fermer}
            aria-label="Fermer"
            className="-m-1 rounded p-1 text-text-secondary hover:text-text-primary"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-surface-border px-4 py-3">
          {/*
            « Pas pour moi » dit ce qu'il fait : le conseil est rangé, pas
            supprimé. Un libellé « Ne plus afficher » promettrait un définitif
            que le système ne pratique pas.
          */}
          <button
            type="button"
            onClick={() => {
              void releguerConseilAction(conseil.id);
              fermer();
            }}
            className="text-body-sm text-text-secondary hover:text-text-primary"
          >
            Pas pour moi
          </button>
          <button
            type="button"
            onClick={() => {
              void reporterConseilAction(conseil.id);
              fermer();
            }}
            className="text-body-sm text-text-secondary hover:text-text-primary"
          >
            Plus tard
          </button>
          {conseil.actionHref && (
            <Button asChild size="sm">
              <Link
                href={conseil.actionHref}
                onClick={() => {
                  void suivreConseilAction(conseil.id);
                  fermer();
                }}
              >
                {conseil.actionLabel ?? 'Y aller'}
              </Link>
            </Button>
          )}
          {!conseil.actionHref && (
            <Button
              size="sm"
              onClick={() => {
                void suivreConseilAction(conseil.id);
                fermer();
              }}
            >
              J&apos;ai compris
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

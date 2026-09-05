'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, Lightbulb, X } from 'lucide-react';
import { cn } from '@/lib/utils';
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
 * **Deux présentations, une seule logique.** Sur desktop, une carte flottante
 * en bas à droite. Sous `md`, ce coin est déjà pris par le bouton d'action des
 * listes et surplombé par la barre d'onglets : le conseil devient une bannière
 * fine sous l'en-tête. Le minuteur, le compteur de pages et les trois issues
 * sont partagés — deux composants séparés relanceraient chacun leur délai, et
 * un même conseil pourrait être reporté deux fois.
 *
 * **La bannière est repliée au repos.** Elle ne montre que le titre et se
 * déplie au toucher. Un conseil qui s'impose sur trois lignes en haut d'un
 * écran de 390px recouvre ce que la personne était venue lire ; replié, il
 * occupe une ligne et reste refusable d'un seul geste.
 *
 * **Le panneau est bleu, le texte blanc.** L'inverse — une carte claire
 * bordée de gris — se confond avec les cartes de contenu de la page, et un
 * conseil qui ressemble au décor n'est pas lu. La couleur est ici le seul
 * moyen de dire « ceci n'est pas la page, c'est une proposition ».
 *
 * **Il entre et sort en mouvement.** Une disparition instantanée se lit comme
 * un défaut d'affichage plutôt que comme le résultat du geste : on ne sait
 * plus si on a fermé ou si l'écran a sauté. L'état `sortant` joue l'animation
 * avant de démonter — les trois issues écrivent en base immédiatement, seul
 * le démontage attend.
 *
 * **Un avertissement d'abonnement la fait taire.** La bannière est en `fixed`
 * sous l'en-tête et recouvrirait `AbonnementBanner`, qui annonce une perte
 * d'écriture imminente. Entre une suggestion et une échéance, c'est
 * l'échéance qui passe.
 */

/** Compteur de pages vues dans l'onglet. Le premier écran ne compte pas. */
const CLE_PAGES = 'scolargest.conseils.pages';

/** Délai avant apparition, une fois la page posée. */
const DELAI_MS = 6000;

/** Durée de l'animation de sortie. Doit valoir `animate-conseil-out`. */
const DUREE_SORTIE_MS = 180;

/**
 * L'action principale, inversée : fond blanc sur la carte bleue. Partagée par
 * les deux présentations pour qu'elles ne divergent pas — c'est la seule chose
 * cliquable des deux côtés, elle doit se ressembler.
 */
const ACTION_INVERSEE =
  'inline-flex h-row-standard shrink-0 items-center justify-center rounded-lg bg-white px-4 text-touch-label text-primary transition-colors hover:bg-primary-fixed';

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
  const [deplie, setDeplie] = React.useState(false);
  const [sortant, setSortant] = React.useState(false);
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

    // La bannière mobile est en `fixed` sous l'en-tête et recouvrirait le
    // bandeau d'abonnement, qui annonce une perte d'écriture imminente. Elle
    // lui cède donc le pas — mais la garde doit se poser **ici**, avant la
    // demande, et non au rendu.
    //
    // Posée au rendu, elle produisait exactement la vue fantôme que ce
    // composant cherche à éviter : `demanderConseil` marque `vuLe` côté
    // serveur et arme le délai de 24 heures, si bien que le conseil était
    // consommé sans avoir jamais été affiché. Et ce n'est pas un cas de bord —
    // `AbonnementBanner` s'affiche pour tout niveau d'accès autre que `OK`,
    // donc pendant les trente jours d'essai de chaque nouvelle école : un
    // Directeur travaillant au téléphone pendant son essai n'aurait vu aucun
    // conseil tout en en brûlant un par jour, au moment précis où ils lui
    // servent le plus. Défaut signalé par SOKO le 2026-09-04.
    //
    // La condition de largeur est indispensable : seule la bannière cède le
    // pas, la carte de bureau n'a jamais été masquée. Sans elle, un poste de
    // bureau perdrait ses conseils pendant tout l'essai.
    const petitEcran = window.matchMedia('(max-width: 767px)').matches;
    if (petitEcran && document.querySelector('[data-bandeau="abonnement"]')) return;

    const minuteur = setTimeout(() => {
      // La garde est relue **ici**, et pas seulement à l'entrée de l'effet.
      // Elle y est posée avant le `setTimeout`, ce qui laisse passer deux
      // minuteurs si deux effets se sont exécutés sans nettoyage entre eux :
      // chacun rappellerait `demanderConseil`, donc `marquerConseilVu`, et le
      // conseil serait compté vu deux fois. Une vérification observée le
      // 2026-09-04 a relevé deux requêtes là où une seule était attendue,
      // sans que la cause soit reproductible — la relire au déclenchement rend
      // la question sans objet.
      if (demande.current) return;
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
    // L'écriture en base a déjà eu lieu chez l'appelant : on ne retarde que
    // le démontage, le temps que l'animation de sortie se joue.
    setSortant(true);
    window.setTimeout(() => {
      setConseil(null);
      setSortant(false);
      // Le prochain conseil de la session repart replie : deplie une fois ne
      // veut pas dire deplie toujours.
      setDeplie(false);
    }, DUREE_SORTIE_MS);
  }

  function reporter() {
    void reporterConseilAction(conseil!.id);
    fermer();
  }

  function releguer() {
    void releguerConseilAction(conseil!.id);
    fermer();
  }

  function suivre() {
    void suivreConseilAction(conseil!.id);
    fermer();
  }

  return (
    <>
      {/*
        Bannière mobile, sous l'en-tête. Repliée au repos : le titre seul, sur
        une ligne. Le bouton qui la déplie fait toute la largeur et 44px de
        haut — c'est la cible, la pastille et le chevron ne sont que le rendu.

        `z-20` la place sous l'en-tête (`z-30`), qui doit rester cliquable :
        une bannière de suggestion ne prend jamais le pas sur la navigation.
      */}
      <div className="fixed inset-x-0 top-header z-20 px-gutter pt-2 md:hidden">
        <div
          className={cn(
            'overflow-hidden rounded-xl bg-gradient-to-br from-primary to-primary-container shadow-floating',
            sortant ? 'animate-banniere-out' : 'animate-banniere-in',
          )}
        >
          <div className="flex items-center gap-1 pr-1">
            <button
              type="button"
              onClick={() => setDeplie((v) => !v)}
              aria-expanded={deplie}
              className="flex min-h-row-standard min-w-0 flex-1 items-center gap-2.5 py-2 pl-3 text-left"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-white">
                <Lightbulb className="size-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1 truncate text-touch-label text-white">
                {conseil.titre}
              </span>
              <ChevronDown
                className={cn(
                  'size-4 shrink-0 text-white/70 transition-transform',
                  deplie && 'rotate-180',
                )}
                aria-hidden
              />
            </button>

            {/*
                Fermer vaut « Plus tard », jamais « Pas pour moi » : c'est le
                geste réflexe, et il ne doit pas produire la sanction la plus
                lourde. Le refus durable reste un choix explicite, dans le
                panneau déplié.
              */}
            <button
              type="button"
              onClick={reporter}
              aria-label="Plus tard"
              className="grid size-row-standard shrink-0 place-items-center rounded-lg text-white/70 active:bg-white/10"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>

          {deplie && (
            <div className="border-t border-white/15 px-3 pb-3 pt-2.5">
              <p className="text-touch-meta text-white/80">{conseil.texte}</p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={releguer}
                  className="h-row-standard shrink-0 rounded-lg px-2 text-touch-meta text-white/75 active:bg-white/10"
                >
                  Pas pour moi
                </button>
                {/*
                  Sur fond bleu, le bouton primaire du système disparaîtrait :
                  il est bleu lui aussi. L'action s'inverse — fond blanc, texte
                  primaire — ce qui lui rend le contraste que la carte vient de
                  prendre au reste de la page.
                */}
                {conseil.actionHref ? (
                  <Link
                    href={conseil.actionHref}
                    onClick={suivre}
                    className={cn(ACTION_INVERSEE, 'ml-auto')}
                  >
                    {conseil.actionLabel ?? 'Y aller'}
                  </Link>
                ) : (
                  <button type="button" onClick={suivre} className={cn(ACTION_INVERSEE, 'ml-auto')}>
                    J&apos;ai compris
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/*
        Carte de bureau, au-dessus de la bulle de support qui occupe
        `bottom-6 right-6`. Les deux cohabitent : le support est un recours,
        le conseil une proposition.
      */}
      <div className="fixed bottom-24 right-6 z-30 hidden w-80 md:block">
        <div
          className={cn(
            'rounded-lg bg-gradient-to-br from-primary to-primary-container shadow-premium',
            sortant ? 'animate-conseil-out' : 'animate-conseil-in',
          )}
        >
          <div className="flex items-start gap-3 p-4">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-white">
              <Lightbulb className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <p className="text-body-md font-medium text-white">{conseil.titre}</p>
                {conseil.nouveaute && (
                  <span className="shrink-0 text-body-sm text-white/70">Nouveau</span>
                )}
              </div>
              <p className="mt-1 text-body-sm text-white/80">{conseil.texte}</p>
            </div>
            <button
              type="button"
              onClick={fermer}
              aria-label="Fermer"
              className="-m-1 rounded p-1 text-white/70 transition-colors hover:text-white"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/15 px-4 py-3">
            {/*
              « Pas pour moi » dit ce qu'il fait : le conseil est rangé, pas
              supprimé. Un libellé « Ne plus afficher » promettrait un définitif
              que le système ne pratique pas.
            */}
            <button
              type="button"
              onClick={releguer}
              className="text-body-sm text-white/75 transition-colors hover:text-white"
            >
              Pas pour moi
            </button>
            <button
              type="button"
              onClick={reporter}
              className="text-body-sm text-white/75 transition-colors hover:text-white"
            >
              Plus tard
            </button>
            {conseil.actionHref ? (
              <Link href={conseil.actionHref} onClick={suivre} className={ACTION_INVERSEE}>
                {conseil.actionLabel ?? 'Y aller'}
              </Link>
            ) : (
              <button type="button" onClick={suivre} className={ACTION_INVERSEE}>
                J&apos;ai compris
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

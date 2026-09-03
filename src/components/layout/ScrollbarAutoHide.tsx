'use client';

import { useEffect } from 'react';

/** Delai d'inactivite avant effacement du pouce de la scrollbar. */
const DELAI_REPOS_MS = 2000;

/**
 * Efface la scrollbar apres 2s sans defilement, la fait reapparaitre des qu'on
 * defile a nouveau. Le style vit dans `globals.css` ; ce composant ne pose que
 * la classe `scrollbar-repos` sur <html>, faute de selecteur CSS exprimant
 * « inactif depuis n secondes ».
 *
 * Le sens de la classe est celui de l'etat *au repos*, pas de l'etat visible :
 * sans classe la scrollbar s'affiche normalement, donc un navigateur ou le JS
 * ne tourne pas garde une scrollbar parfaitement utilisable. L'inverse — cacher
 * par defaut, montrer par classe — laissait la scrollbar invisible au
 * chargement et sur toute page qu'on ne fait que survoler.
 *
 * L'ecoute est en phase de capture : `scroll` ne remonte pas depuis un
 * conteneur interne (`overflow-auto`), et sans capture le defilement d'une
 * liste ou d'une barre laterale ne reveillerait pas la scrollbar.
 */
export function ScrollbarAutoHide() {
  useEffect(() => {
    const racine = document.documentElement;
    let minuteur: ReturnType<typeof setTimeout> | undefined;

    const programmerRepos = () => {
      if (minuteur) clearTimeout(minuteur);
      minuteur = setTimeout(() => racine.classList.add('scrollbar-repos'), DELAI_REPOS_MS);
    };

    const reveiller = () => {
      racine.classList.remove('scrollbar-repos');
      programmerRepos();
    };

    // Au chargement la scrollbar est visible, puis s'efface si rien ne bouge.
    programmerRepos();
    window.addEventListener('scroll', reveiller, { passive: true, capture: true });

    return () => {
      window.removeEventListener('scroll', reveiller, true);
      if (minuteur) clearTimeout(minuteur);
      racine.classList.remove('scrollbar-repos');
    };
  }, []);

  return null;
}

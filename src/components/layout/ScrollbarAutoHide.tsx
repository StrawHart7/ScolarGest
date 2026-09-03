'use client';

import { useEffect } from 'react';

/**
 * Pose `scrollbar-visible` sur <html> pendant le defilement, la retire 2s
 * apres le dernier evenement. Le style reel (couleur, opacite) vit dans
 * `globals.css` — ce composant ne fait que piloter la classe, pas la
 * scrollbar reelle sur mobile ou l'evenement `scroll` sur `window` ne se
 * declenche pas toujours pour un scroll a l'interieur d'un conteneur : il
 * ecoute donc en phase de capture pour attraper aussi le defilement d'une
 * zone interne (`overflow-auto`).
 */
export function ScrollbarAutoHide() {
  useEffect(() => {
    const racine = document.documentElement;
    let minuteur: ReturnType<typeof setTimeout> | undefined;

    const surDefilement = () => {
      racine.classList.add('scrollbar-visible');
      if (minuteur) clearTimeout(minuteur);
      minuteur = setTimeout(() => {
        racine.classList.remove('scrollbar-visible');
      }, 2000);
    };

    window.addEventListener('scroll', surDefilement, { passive: true, capture: true });

    return () => {
      window.removeEventListener('scroll', surDefilement, true);
      if (minuteur) clearTimeout(minuteur);
      racine.classList.remove('scrollbar-visible');
    };
  }, []);

  return null;
}

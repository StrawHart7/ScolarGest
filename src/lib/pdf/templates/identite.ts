/**
 * Identité visuelle commune aux documents générés : logo et filigrane.
 *
 * Partagé par les trois gabarits (bulletin générique, bulletin secondaire,
 * reçu) — un filigrane qui diffère d'un document à l'autre trahirait l'objectif
 * même d'une identité d'établissement.
 *
 * Le logo arrive en data URI : le bucket `documents` est privé et n'expose
 * aucune URL publique. Chromium n'aurait de toute façon pas de session pour
 * aller chercher un fichier protégé au moment du rendu.
 */

export interface IdentiteDocument {
  /** Logo déjà encodé en data URI, ou `null` si l'établissement n'en a pas. */
  logoDataUri: string | null;
  /** Texte du filigrane, ou `null` si désactivé. */
  filigraneTexte: string | null;
}

function esc(v: string): string {
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * CSS du filigrane et du logo.
 *
 * `position: fixed` est ce qui fait répéter le filigrane sur **chaque page**
 * du PDF : Chromium réimprime les éléments fixés à chaque feuille. En
 * `absolute`, il n'apparaîtrait que sur la première.
 *
 * L'opacité reste basse et `print-color-adjust: exact` force Chromium à
 * conserver la teinte — sans quoi l'optimisation d'impression peut effacer un
 * gris très clair.
 */
export const STYLE_IDENTITE = `
  .filigrane {
    position: fixed;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%) rotate(-35deg);
    font-size: 68px;
    font-weight: bold;
    letter-spacing: 4px;
    color: #1b3a6b;
    opacity: 0.07;
    white-space: nowrap;
    pointer-events: none;
    user-select: none;
    z-index: 0;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  /* Le contenu doit passer au-dessus du filigrane, sans quoi le texte du
     document serait recouvert. */
  body > *:not(.filigrane) { position: relative; z-index: 1; }
  .logo-etablissement {
    max-height: 64px;
    max-width: 120px;
    object-fit: contain;
    display: block;
    margin: 0 auto 4px;
  }
`;

/** Calque du filigrane, ou chaîne vide si aucun texte n'est configuré. */
export function htmlFiligrane(identite: IdentiteDocument | undefined): string {
  const texte = identite?.filigraneTexte?.trim();
  if (!texte) return '';
  return `<div class="filigrane" aria-hidden="true">${esc(texte)}</div>`;
}

/** Balise du logo, ou chaîne vide si l'établissement n'en a pas. */
export function htmlLogo(identite: IdentiteDocument | undefined): string {
  if (!identite?.logoDataUri) return '';
  return `<img class="logo-etablissement" src="${identite.logoDataUri}" alt="" />`;
}

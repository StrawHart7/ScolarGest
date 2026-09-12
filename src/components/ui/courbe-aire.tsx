'use client';

import * as React from 'react';
import {
  calculerBornes,
  cheminLisse,
  positionsX,
  positionY,
  libelleMois,
  abregerMontant,
} from '@/lib/graphes';
import { cn } from '@/lib/utils';
import { formaterValeur, type FormatValeur } from '@/lib/format-graphe';

/**
 * Courbe d'evolution mensuelle, aire degradee sous le trace.
 *
 * **Une seule serie, donc aucune legende** : le titre de la carte nomme ce qui
 * est trace. Une legende d'un element est du bruit.
 *
 * Le survol est natif, pas optionnel : un graphe en HTML qui ne repond pas au
 * curseur donne l'impression d'une image. La zone de capture couvre toute la
 * hauteur de la colonne du mois, bien plus large que le point lui-meme — viser
 * un cercle de 4 px a la souris est un mauvais objectif, et impossible au
 * doigt.
 *
 * Le trace est lisse par interpolation **monotone** (voir `cheminLisse`) : une
 * spline ordinaire plongerait sous la ligne de base entre un mois vide et un
 * gros mois, affichant des recettes negatives.
 *
 * **Elle repond aussi au clavier.** Le graphe n'etait atteignable qu'a la
 * souris : la valeur de chaque mois etait donc hors de portee sans pointeur,
 * alors que c'est la seule information qu'il porte. Le conteneur prend le
 * focus, les fleches parcourent les mois, et la valeur atteinte est annoncee
 * dans une region vocale — l'infobulle visuelle ne dit rien a un lecteur
 * d'ecran.
 *
 * **Deux gabarits.** Le cadre etait fige a 720x240, et un SVG en `w-full`
 * se met a l'echelle de son conteneur : sur un telephone de 390px, tout etait
 * divise par deux — 117px de hauteur de trace, et des etiquettes de mois
 * rendues a 5px, sous le plancher lisible de l'echelle. Le gabarit etroit
 * redresse le cadre (380x250, donc presque carre), grossit les textes et
 * n'affiche qu'un mois sur deux, faute de quoi douze etiquettes se
 * chevaucheraient sur 328 unites de large.
 *
 * Le dernier mois est toujours etiquete : l'elagage se compte depuis la fin,
 * pas depuis le debut. Sauter le mois en cours pour garder celui d'il y a un
 * an serait exactement le mauvais arbitrage.
 *
 * **Deux tons.** `clair` sur une carte blanche, `sombre` sur le bandeau de la
 * console plateforme. Les couleurs etaient ecrites en dur dans le SVG : posee
 * sur un fond fonce, la courbe disparaissait — grille grise sur bleu nuit,
 * etiquettes illisibles. Un seul composant a deux palettes, plutot qu'un
 * second graphe a maintenir en parallele.
 */

/**
 * Les deux cadres. `margeDroite` existe parce que le dernier point touche le
 * bord droit du trace : son etiquette de mois, centree dessus, deborderait de
 * la moitie de sa largeur.
 */
const GABARIT = {
  large: {
    L: 720,
    H: 240,
    margeGauche: 52,
    margeDroite: 20,
    margeBasse: 28,
    margeHaute: 12,
    police: 11,
    /** 1 = toutes les etiquettes de mois. */
    pasEtiquette: 1,
  },
  etroit: {
    L: 380,
    H: 250,
    margeGauche: 40,
    margeDroite: 14,
    margeBasse: 26,
    margeHaute: 10,
    police: 12,
    pasEtiquette: 2,
  },
} as const;

export type TonCourbe = 'clair' | 'sombre';

/**
 * Les deux palettes.
 *
 * Le ton sombre ne reprend pas le bleu primaire : pose sur le bleu nuit du
 * bandeau, un trait de 2px s'y fondrait et l'aire sous la courbe serait
 * indistincte du fond. `inverse-primary` (#b2c5ff) est la teinte que le
 * systeme reserve deja aux fonds sombres.
 */
const PALETTE: Record<
  TonCourbe,
  {
    trace: string;
    opaciteAire: number;
    grille: string;
    texte: string;
    texteActif: string;
    repere: string;
    anneau: string;
  }
> = {
  clair: {
    trace: '#0052cc',
    opaciteAire: 0.22,
    grille: '#DFE1E6',
    texte: '#44546F',
    texteActif: '#172B4D',
    repere: '#44546F',
    anneau: '#ffffff',
  },
  sombre: {
    trace: '#b2c5ff',
    opaciteAire: 0.28,
    grille: 'rgba(255, 255, 255, 0.14)',
    texte: 'rgba(255, 255, 255, 0.58)',
    texteActif: '#ffffff',
    repere: 'rgba(255, 255, 255, 0.45)',
    // L'anneau du point vaut le fond sur lequel il est pose, pas du blanc : un
    // disque blanc sur bleu nuit ferait une tache.
    anneau: '#0c2a63',
  },
};

export interface PointCourbe {
  mois: string;
  valeur: number;
}

interface Props {
  points: PointCourbe[];
  /** Mise en forme de la valeur dans l'infobulle. Un **nom**, pas une fonction :
      une fonction ne traverse pas la frontiere serveur/client. */
  format?: FormatValeur;
  /** Identifiant unique du degrade : deux courbes sur une page se marcheraient dessus. */
  id: string;
  /** Palette. `sombre` pour une pose sur fond fonce. */
  ton?: TonCourbe;
  className?: string;
}

export function CourbeAire({ points, format = 'nombre', id, ton = 'clair', className }: Props) {
  const [survole, setSurvole] = React.useState<number | null>(null);
  const [etroit, setEtroit] = React.useState(false);
  const svgRef = React.useRef<SVGSVGElement>(null);
  const p = PALETTE[ton];

  // Le gabarit se choisit a l'execution et non par media query CSS : les
  // coordonnees du trace sont calculees en JavaScript, une regle CSS ne
  // pourrait pas les refaire. Le premier rendu prend le gabarit large, comme
  // le serveur, puis bascule — il n'y a donc pas d'ecart d'hydratation.
  React.useEffect(() => {
    const requete = window.matchMedia('(max-width: 767px)');
    const appliquer = () => setEtroit(requete.matches);
    appliquer();
    requete.addEventListener('change', appliquer);
    return () => requete.removeEventListener('change', appliquer);
  }, []);

  const g = etroit ? GABARIT.etroit : GABARIT.large;
  const LARGEUR = g.L - g.margeGauche - g.margeDroite;
  const HAUTEUR = g.H - g.margeBasse - g.margeHaute;

  const bornes = React.useMemo(() => calculerBornes(points.map((pt) => pt.valeur)), [points]);
  const xs = React.useMemo(() => positionsX(points.length, LARGEUR), [points.length, LARGEUR]);
  const coords = React.useMemo(
    () => points.map((pt, i) => ({ x: xs[i] ?? 0, y: positionY(pt.valeur, bornes, HAUTEUR) })),
    [points, xs, bornes, HAUTEUR],
  );

  const trace = React.useMemo(() => cheminLisse(coords), [coords]);
  // L'aire reprend le trace et redescend a la ligne de base : un seul chemin,
  // donc aucun risque que le remplissage se decale du trait.
  const aire = trace ? `${trace} L ${xs.at(-1) ?? 0} ${HAUTEUR} L ${xs[0] ?? 0} ${HAUTEUR} Z` : '';

  function surDeplacement(e: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg || points.length === 0) return;
    const boite = svg.getBoundingClientRect();
    // On repasse en coordonnees du viewBox : le SVG est mis a l'echelle par la
    // largeur du conteneur, la position en pixels ne s'y transpose pas telle
    // quelle.
    const xLocal = ((e.clientX - boite.left) / boite.width) * g.L - g.margeGauche;
    let plusProche = 0;
    for (let i = 1; i < xs.length; i += 1) {
      if (Math.abs(xs[i]! - xLocal) < Math.abs(xs[plusProche]! - xLocal)) plusProche = i;
    }
    setSurvole(plusProche);
  }

  /**
   * Parcours au clavier. Le mois en cours est le dernier point : c'est la ou
   * l'oeil se pose en premier, donc la ou le clavier doit entrer.
   */
  function surTouche(e: React.KeyboardEvent<HTMLDivElement>) {
    if (points.length === 0) return;
    const dernier = points.length - 1;
    const actuel = survole ?? dernier;
    let cible: number;

    if (e.key === 'ArrowRight') cible = Math.min(dernier, actuel + 1);
    else if (e.key === 'ArrowLeft') cible = Math.max(0, actuel - 1);
    else if (e.key === 'Home') cible = 0;
    else if (e.key === 'End') cible = dernier;
    else if (e.key === 'Escape') {
      setSurvole(null);
      return;
    } else return;

    e.preventDefault();
    setSurvole(cible);
  }

  const actif = survole !== null ? (points[survole] ?? null) : null;
  const actifCoord = survole !== null ? (coords[survole] ?? null) : null;
  const dernierCoord = coords.at(-1) ?? null;

  // L'infobulle bascule du cote oppose pres du bord droit, sinon elle sort de
  // la carte sur les derniers mois — ceux qu'on regarde le plus.
  const infobulleADroite = actifCoord ? actifCoord.x < LARGEUR - 130 : true;

  return (
    <div
      className={cn(
        'relative w-full rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        ton === 'sombre'
          ? 'focus-visible:ring-inverse-primary focus-visible:ring-offset-transparent'
          : 'focus-visible:ring-primary-container focus-visible:ring-offset-surface-container-lowest',
        className,
      )}
      tabIndex={0}
      onKeyDown={surTouche}
      onBlur={() => setSurvole(null)}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${g.L} ${g.H}`}
        className="h-auto w-full touch-none"
        role="img"
        aria-label={`Evolution sur ${points.length} mois. Fleches gauche et droite pour parcourir les mois.`}
        onPointerMove={surDeplacement}
        onPointerLeave={() => setSurvole(null)}
      >
        <defs>
          <linearGradient id={`${id}-aire`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={p.trace} stopOpacity={p.opaciteAire} />
            <stop offset="100%" stopColor={p.trace} stopOpacity="0" />
          </linearGradient>
        </defs>

        <g transform={`translate(${g.margeGauche}, ${g.margeHaute})`}>
          {/* Grille recessive : elle situe, elle ne se regarde pas. */}
          {bornes.graduations.map((valeur) => {
            const y = positionY(valeur, bornes, HAUTEUR);
            return (
              <g key={valeur}>
                <line
                  x1={0}
                  y1={y}
                  x2={LARGEUR}
                  y2={y}
                  stroke={p.grille}
                  strokeWidth={1}
                  strokeDasharray={valeur === 0 ? undefined : '3 5'}
                  vectorEffect="non-scaling-stroke"
                />
                <text
                  x={-10}
                  y={y}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fontSize={g.police}
                  fill={p.texte}
                >
                  {abregerMontant(valeur)}
                </text>
              </g>
            );
          })}

          {/* L'aire paraît apres le trace : elle n'a de sens qu'une fois la
              ligne posee, et l'inverse donnait un aplat qui se remplissait
              tout seul. */}
          {aire && (
            <path
              d={aire}
              fill={`url(#${id}-aire)`}
              className="animate-fade-in"
              style={{ animationDelay: '520ms', animationFillMode: 'both' }}
            />
          )}
          {trace && (
            <path
              d={trace}
              fill="none"
              stroke={p.trace}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              // `pathLength` normalise la longueur du chemin a 1 : le decalage
              // du tirete va donc de 1 a 0 quel que soit le nombre de mois.
              pathLength={1}
              strokeDasharray={1}
              className="animate-trace-dessin"
            />
          )}

          {/* Le mois en cours reste marque en permanence : c'est le point qu'on
              cherche en ouvrant la page, et le seul dont la position se lit
              sans avoir rien a survoler. */}
          {dernierCoord && survole === null && (
            <g pointerEvents="none" className="animate-fade-in" style={{ animationDelay: '760ms' }}>
              <circle cx={dernierCoord.x} cy={dernierCoord.y} r={7} fill={p.anneau} />
              <circle cx={dernierCoord.x} cy={dernierCoord.y} r={4} fill={p.trace} />
            </g>
          )}

          {/* Repere vertical + point, au survol comme au clavier. */}
          {actifCoord && (
            <g pointerEvents="none">
              <line
                x1={actifCoord.x}
                y1={0}
                x2={actifCoord.x}
                y2={HAUTEUR}
                stroke={p.repere}
                strokeWidth={1}
                strokeDasharray="3 4"
                vectorEffect="non-scaling-stroke"
              />
              {/* Anneau : le point reste lisible meme pose sur l'aire. */}
              <circle cx={actifCoord.x} cy={actifCoord.y} r={6} fill={p.anneau} />
              <circle cx={actifCoord.x} cy={actifCoord.y} r={4} fill={p.trace} />
            </g>
          )}

          {points.map((pt, i) => {
            // L'elagage se compte depuis la fin : le mois en cours garde
            // toujours son etiquette.
            const rang = points.length - 1 - i;
            if (rang % g.pasEtiquette !== 0 && survole !== i) return null;
            return (
              <text
                key={pt.mois}
                x={xs[i]}
                y={HAUTEUR + 18}
                textAnchor="middle"
                fontSize={g.police}
                fill={survole === i ? p.texteActif : p.texte}
                fontWeight={survole === i ? 600 : 400}
              >
                {libelleMois(pt.mois)}
              </text>
            );
          })}
        </g>
      </svg>

      {/* Infobulle en HTML et non en SVG : le texte y reste selectionnable et
          suit les reglages de police du systeme. */}
      {actif && actifCoord && (
        <div
          className="pointer-events-none absolute z-10 -translate-y-1/2 rounded-lg bg-inverse-surface px-3 py-2 shadow-lg"
          style={{
            left: `${((g.margeGauche + actifCoord.x) / g.L) * 100}%`,
            top: `${((g.margeHaute + actifCoord.y) / g.H) * 100}%`,
            marginLeft: infobulleADroite ? 14 : undefined,
            transform: infobulleADroite
              ? 'translateY(-50%)'
              : 'translate(calc(-100% - 14px), -50%)',
          }}
        >
          <p className="whitespace-nowrap text-label-md capitalize text-inverse-on-surface/70">
            {libelleMois(actif.mois)} {actif.mois.slice(0, 4)}
          </p>
          <p
            className="whitespace-nowrap text-body-md font-semibold text-inverse-on-surface"
            data-mono
          >
            {formaterValeur(actif.valeur, format)}
          </p>
        </div>
      )}

      {/* L'infobulle est visuelle. Sans cette region, le parcours au clavier
          deplacerait un repere que rien n'annonce. */}
      <span aria-live="polite" className="sr-only">
        {actif
          ? `${libelleMois(actif.mois)} ${actif.mois.slice(0, 4)} : ${formaterValeur(actif.valeur, format)}`
          : ''}
      </span>
    </div>
  );
}

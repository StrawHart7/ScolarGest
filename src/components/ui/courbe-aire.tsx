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
 */

const L = 720;
const H = 240;
const MARGE_GAUCHE = 52;
const MARGE_BASSE = 28;
const MARGE_HAUTE = 12;

const LARGEUR = L - MARGE_GAUCHE;
const HAUTEUR = H - MARGE_BASSE - MARGE_HAUTE;

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
  className?: string;
}

export function CourbeAire({ points, format = 'nombre', id, className }: Props) {
  const [survole, setSurvole] = React.useState<number | null>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);

  const bornes = React.useMemo(() => calculerBornes(points.map((p) => p.valeur)), [points]);
  const xs = React.useMemo(() => positionsX(points.length, LARGEUR), [points.length]);
  const coords = React.useMemo(
    () => points.map((p, i) => ({ x: xs[i] ?? 0, y: positionY(p.valeur, bornes, HAUTEUR) })),
    [points, xs, bornes],
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
    const xLocal = ((e.clientX - boite.left) / boite.width) * L - MARGE_GAUCHE;
    let plusProche = 0;
    for (let i = 1; i < xs.length; i += 1) {
      if (Math.abs(xs[i]! - xLocal) < Math.abs(xs[plusProche]! - xLocal)) plusProche = i;
    }
    setSurvole(plusProche);
  }

  const actif = survole !== null ? points[survole] ?? null : null;
  const actifCoord = survole !== null ? coords[survole] ?? null : null;

  // L'infobulle bascule du cote oppose pres du bord droit, sinon elle sort de
  // la carte sur les derniers mois — ceux qu'on regarde le plus.
  const infobulleADroite = actifCoord ? actifCoord.x < LARGEUR - 130 : true;

  return (
    <div className={cn('relative w-full', className)}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${L} ${H}`}
        className="h-auto w-full touch-none"
        role="img"
        aria-label={`Evolution sur ${points.length} mois`}
        onPointerMove={surDeplacement}
        onPointerLeave={() => setSurvole(null)}
      >
        <defs>
          <linearGradient id={`${id}-aire`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0052cc" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#0052cc" stopOpacity="0" />
          </linearGradient>
        </defs>

        <g transform={`translate(${MARGE_GAUCHE}, ${MARGE_HAUTE})`}>
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
                  stroke="#DFE1E6"
                  strokeWidth={1}
                  strokeDasharray={valeur === 0 ? undefined : '3 5'}
                  vectorEffect="non-scaling-stroke"
                />
                <text
                  x={-10}
                  y={y}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fontSize={11}
                  fill="#44546F"
                >
                  {abregerMontant(valeur)}
                </text>
              </g>
            );
          })}

          {aire && <path d={aire} fill={`url(#${id}-aire)`} />}
          {trace && (
            <path
              d={trace}
              fill="none"
              stroke="#0052cc"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          )}

          {/* Repere vertical + point, uniquement au survol. */}
          {actifCoord && (
            <g pointerEvents="none">
              <line
                x1={actifCoord.x}
                y1={0}
                x2={actifCoord.x}
                y2={HAUTEUR}
                stroke="#44546F"
                strokeWidth={1}
                strokeDasharray="3 4"
                vectorEffect="non-scaling-stroke"
              />
              {/* Anneau blanc : le point reste lisible meme pose sur l'aire. */}
              <circle cx={actifCoord.x} cy={actifCoord.y} r={6} fill="#ffffff" />
              <circle cx={actifCoord.x} cy={actifCoord.y} r={4} fill="#0052cc" />
            </g>
          )}

          {points.map((p, i) => (
            <text
              key={p.mois}
              x={xs[i]}
              y={HAUTEUR + 18}
              textAnchor="middle"
              fontSize={11}
              fill={survole === i ? '#172B4D' : '#44546F'}
              fontWeight={survole === i ? 600 : 400}
            >
              {libelleMois(p.mois)}
            </text>
          ))}
        </g>
      </svg>

      {/* Infobulle en HTML et non en SVG : le texte y reste selectionnable et
          suit les reglages de police du systeme. */}
      {actif && actifCoord && (
        <div
          className="pointer-events-none absolute z-10 -translate-y-1/2 rounded-lg bg-inverse-surface px-3 py-2 shadow-lg"
          style={{
            left: `${((MARGE_GAUCHE + actifCoord.x) / L) * 100}%`,
            top: `${((MARGE_HAUTE + actifCoord.y) / H) * 100}%`,
            marginLeft: infobulleADroite ? 14 : undefined,
            transform: infobulleADroite
              ? 'translateY(-50%)'
              : 'translate(calc(-100% - 14px), -50%)',
          }}
        >
          <p className="whitespace-nowrap text-label-md capitalize text-inverse-on-surface/70">
            {libelleMois(actif.mois)} {actif.mois.slice(0, 4)}
          </p>
          <p className="whitespace-nowrap text-body-md font-semibold text-inverse-on-surface">
            {formaterValeur(actif.valeur, format)}
          </p>
        </div>
      )}
    </div>
  );
}

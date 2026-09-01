'use client';

import * as React from 'react';
import { arcAnneau } from '@/lib/graphes';
import { cn } from '@/lib/utils';
import { formaterValeur, type FormatValeur } from '@/lib/format-graphe';

/**
 * Anneau de repartition, valeur mise en avant au centre.
 *
 * **Chaque part est etiquetee dans la legende, jamais identifiee par la seule
 * couleur.** Le trio retenu passe la validation de daltonisme sur les axes
 * deutan et protan, mais la separation tritan reste dans la bande plancher :
 * l'etiquette directe est ce qui rend l'ensemble legal, pas un ornement.
 *
 * Un ecart de 2 px separe les segments. Sans lui, deux parts voisines de
 * teintes proches se lisent comme une seule.
 *
 * Trois parts au maximum, volontairement. Au-dela, un anneau devient un jeu de
 * devinettes et une liste ordonnee dit la meme chose mieux.
 */

/** Palette de statut, validee sur surface blanche. Ordre fixe, jamais permute. */
export const TEINTES_STATUT = {
  bon: '#00875a',
  neutre: '#0052cc',
  critique: '#de350b',
} as const;

export type TeinteStatut = keyof typeof TEINTES_STATUT;

export interface PartAnneau {
  libelle: string;
  valeur: number;
  teinte: TeinteStatut;
}

interface Props {
  parts: PartAnneau[];
  /** Grand nombre au centre. */
  valeurCentrale: string;
  /** Legende sous le nombre central. */
  libelleCentral: string;
  /** Mise en forme des valeurs de la legende. Un **nom**, pas une fonction :
      une fonction ne traverse pas la frontiere serveur/client. */
  format?: FormatValeur;
  className?: string;
}

const TAILLE = 176;
const CENTRE = TAILLE / 2;
const RAYON_EXT = 80;
const RAYON_INT = 58;
/** Ecart entre segments, en degres — ~2 px au rayon exterieur. */
const ECART = 1.6;

export function AnneauRepartition({
  parts,
  valeurCentrale,
  libelleCentral,
  format = 'nombre',
  className,
}: Props) {
  const total = parts.reduce((s, p) => s + p.valeur, 0);

  const segments = React.useMemo(() => {
    if (total <= 0) return [];
    // Les parts nulles sont ecartees : un arc de zero degre produirait un
    // chemin vide, et l'ecart de separation le rendrait meme negatif.
    const visibles = parts.filter((p) => p.valeur > 0);
    let angle = 0;
    return visibles.map((part, i) => {
      const balaye = (part.valeur / total) * 360;
      const debut = angle;
      angle += balaye;
      // Pas d'ecart s'il n'y a qu'une part : l'anneau doit se refermer.
      const marge = visibles.length > 1 ? ECART / 2 : 0;
      return {
        ...part,
        pourcentage: (part.valeur / total) * 100,
        chemin: arcAnneau(
          CENTRE,
          CENTRE,
          RAYON_EXT,
          RAYON_INT,
          debut + marge,
          Math.max(debut + marge, angle - marge),
        ),
        cle: `${part.libelle}-${i}`,
      };
    });
  }, [parts, total]);

  return (
    <div
      className={cn('flex flex-col items-center gap-5 sm:flex-row sm:gap-6', className)}
    >
      <div className="relative shrink-0">
        <svg
          viewBox={`0 0 ${TAILLE} ${TAILLE}`}
          className="h-44 w-44"
          role="img"
          aria-label={parts
            .map((p) => `${p.libelle} : ${formaterValeur(p.valeur, format)}`)
            .join(', ')}
        >
          {/* Piste de fond : sans elle, un anneau vide n'est rien du tout. */}
          <path
            d={arcAnneau(CENTRE, CENTRE, RAYON_EXT, RAYON_INT, 0, 360)}
            fill="#EDEEF0"
          />
          {segments.map((s) => (
            <path key={s.cle} d={s.chemin} fill={TEINTES_STATUT[s.teinte]} />
          ))}
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-headline-md text-text-primary" data-mono>
            {valeurCentrale}
          </span>
          <span className="text-label-md text-text-secondary">{libelleCentral}</span>
        </div>
      </div>

      {/* Legende toujours presente : l'identite ne repose jamais sur la couleur
          seule, et le pourcentage evite d'avoir a estimer un angle a l'oeil. */}
      {/* Largeur bornee : dans une carte pleine largeur, la legende s'etirait
          sur toute la page et laissait un vide entre le libelle et sa valeur. */}
      <ul className="flex w-full min-w-0 max-w-sm flex-col gap-2.5">
        {parts.map((part) => {
          const pourcentage = total > 0 ? (part.valeur / total) * 100 : 0;
          return (
            <li key={part.libelle} className="flex items-center gap-2.5">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: TEINTES_STATUT[part.teinte] }}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate text-body-sm text-text-secondary">
                {part.libelle}
              </span>
              <span className="shrink-0 text-body-sm font-medium text-text-primary" data-mono>
                {formaterValeur(part.valeur, format)}
              </span>
              <span className="w-11 shrink-0 text-right text-body-sm text-text-secondary" data-mono>
                {pourcentage.toFixed(0)} %
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

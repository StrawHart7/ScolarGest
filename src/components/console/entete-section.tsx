import { cn } from '@/lib/utils';

/**
 * En-tête d'une section de console : filet de couleur, intitulé, compte, et
 * une ligne qui définit ce que la section contient.
 *
 * **Le filet n'est pas un ornement.** Il ouvre une section dont la place dans
 * une suite ordonnée veut dire quelque chose — dépassé avant cette semaine,
 * à traiter avant en cours. Mises bout à bout, les sections se lisent comme
 * une piste. Sur une section isolée, il n'a rien à dire : ne pas l'employer là.
 *
 * **Le compte prend la couleur de la section, sauf à zéro.** Un « 0 » en rouge
 * vif annoncerait un problème là où il n'y en a précisément aucun ; à zéro, le
 * chiffre redevient neutre.
 *
 * **La ligne de définition dit ce que la section contient, pas ce qu'il faut
 * en faire.** « Sous 7 jours » se vérifie ; « à relancer d'urgence » est un
 * avis que l'intitulé porte déjà.
 *
 * Extrait de `Echeancier` le 2026-09-12 pour servir aussi la file des demandes
 * de démo : deux copies du même bloc auraient divergé au premier ajustement.
 */
export function EnteteSection({
  titre,
  definition,
  compte,
  couleur,
  niveau = 3,
  dansCarte = true,
  className,
}: {
  titre: string;
  /** Ce que la section contient, en clair et vérifiable. */
  definition: string;
  compte: number;
  /** Teinte du filet et du compte. Palette de statut validée, pas une teinte libre. */
  couleur: string;
  /** `2` dans une page dont les sections sont le premier niveau, `3` sinon. */
  niveau?: 2 | 3;
  /**
   * `true` quand l'en-tête ouvre une colonne à l'intérieur d'une carte : le
   * texte prend alors le retrait de la carte. `false` quand la section est
   * libre sur la page — le retrait désalignerait l'intitulé des cartes posées
   * dessous, qui portent le leur.
   */
  dansCarte?: boolean;
  className?: string;
}) {
  const Titre = niveau === 2 ? 'h2' : 'h3';

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="h-[3px] w-full" style={{ backgroundColor: couleur }} />
      <div className={cn('pb-2 pt-4', dansCarte && 'px-5')}>
        <div className="flex items-baseline justify-between gap-3">
          <Titre className="text-touch-label text-text-primary">{titre}</Titre>
          <span
            className="font-mono text-console-figure-sm text-text-primary"
            data-mono
            style={{ color: compte === 0 ? undefined : couleur }}
          >
            {compte}
          </span>
        </div>
        <p className="text-console-eyebrow uppercase text-text-secondary">{definition}</p>
      </div>
    </div>
  );
}

/**
 * Les teintes de section. Ce sont celles de la palette de statut validée pour
 * le contraste et le daltonisme — jamais des couleurs choisies à l'œil.
 */
export const TEINTE = {
  erreur: '#de350b',
  alerte: '#b45309',
  encours: '#0052cc',
  fait: '#00875a',
  neutre: '#8993a4',
} as const;

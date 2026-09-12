import Link from 'next/link';
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Cartes de metrique des tableaux de bord.
 *
 * D'abord ecrites pour la seule console plateforme, elles servent desormais
 * les cinq tableaux de bord. `StatCard` reste en place pour les grilles
 * compactes ; celle-ci prend le relais des qu'un chiffre merite d'etre
 * explique — c'est-a-dire presque toujours sur un tableau de bord.
 *
 * Trois partis pris repris des references :
 *
 * - **L'icone est une pastille teintee**, pas un glyphe pose sur le fond. Elle
 *   donne un point d'ancrage a l'oeil qui balaie une rangee de cartes.
 * - **La variation est une pilule, avec une fleche.** Le signe seul se lit mal
 *   en petit corps, et la couleur seule ne suffit pas — la fleche porte
 *   l'information pour qui ne distingue pas le vert du rouge.
 * - **Une ligne de comparaison en clair** sous le chiffre. « 2 832 » ne dit
 *   rien ; « contre 3 294 le mois dernier » dit tout.
 *
 * Deux reprises du 2026-09-12 :
 *
 * - **L'intitule passe en cartouche**, micro-capitales espacees, et le chiffre
 *   grandit. Les deux ne se separaient que par 13px contre 26px et un demi-gras
 *   commun : trois elements — intitule, pastille, chiffre — s'y disputaient le
 *   regard, et la carte n'avait pas de sujet. Un ecart franc le lui rend.
 * - **Une carte cliquable le dit.** Elle se distinguait d'une carte inerte par
 *   une ombre au survol, invisible avant de survoler et inexistante au clavier,
 *   ou rien ne signalait meme le focus. Elle porte desormais une fleche, un
 *   soulevement au survol et un anneau de focus.
 *
 * Le chiffre reste en Inter et non dans la fonte a chasse fixe : « 1 450 000 F »
 * y prend un tiers de largeur en plus et deborderait de la colonne etroite
 * d'une grille a deux colonnes sur telephone. L'alignement des chiffres est
 * obtenu par `data-mono`, qui les passe en chasse tabulaire — voir la regle
 * dans `globals.css`.
 */

type Ton = 'primaire' | 'succes' | 'alerte' | 'neutre';

const PASTILLE: Record<Ton, string> = {
  primaire: 'bg-primary-fixed text-primary-container',
  succes: 'bg-tertiary-fixed/60 text-tertiary',
  alerte: 'bg-warning/15 text-warning-on-container',
  neutre: 'bg-surface-container text-text-secondary',
};

export interface CarteMetriqueProps {
  label: string;
  valeur: string;
  icone: LucideIcon;
  ton?: Ton;
  /** Variation en %. `null` quand elle n'a pas de sens — on n'affiche rien. */
  variation?: number | null;
  /** Ligne de comparaison, en clair. */
  comparaison?: string;
  href?: string;
  /**
   * Rendu resserre pour une grille a deux colonnes sur telephone : padding
   * reduit, echelle tactile, comparaison bornee a deux lignes. Au-dela de
   * `md` le rendu est identique au rendu normal — la densite ne change que
   * la ou l'espace manque. Pose par `GrilleCompteurs`, pas a la main.
   */
  compact?: boolean;
}

export function CarteMetrique({
  label,
  valeur,
  icone: Icone,
  ton = 'primaire',
  variation,
  comparaison,
  href,
  compact,
}: CarteMetriqueProps) {
  const contenu = (
    <>
      <div className="flex items-start justify-between gap-2 md:gap-3">
        <p
          className={cn(
            'text-console-eyebrow uppercase text-text-secondary',
            // Le cartouche ne descend pas sous 11px : c'est le plancher de
            // l'echelle, et des capitales espacees se lisent moins bien que
            // du bas-de-casse a taille egale. On resserre donc l'interlettre
            // plutot que le corps.
            //
            // La hauteur est reservee pour deux lignes : dans une grille a
            // deux colonnes sur telephone, « REVENU RECURRENT » se coupe la ou
            // « ECOLES » tient sur une, et les deux chiffres ne partageaient
            // plus la meme ligne de base — le defaut saute aux yeux des que
            // deux cartes se touchent.
            compact && 'max-md:min-h-[28px] max-md:tracking-[0.06em]',
          )}
        >
          {label}
        </p>
        {/* Fleche et pastille forment un bloc. La fleche posee en absolu dans
            un coin chevauchait la ligne de comparaison sur carte etroite ;
            laissee seule dans la ligne, `justify-between` la renvoyait au
            milieu, orpheline entre l'intitule et la pastille. */}
        <span className="flex shrink-0 items-start gap-2">
          {href && (
            <ArrowUpRight
              className="mt-1.5 size-4 text-text-secondary opacity-40 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
              aria-hidden
            />
          )}
          <span className={cn('rounded-lg', PASTILLE[ton], compact ? 'p-1.5 md:p-2' : 'p-2')}>
            <Icone className="h-4 w-4" aria-hidden />
          </span>
        </span>
      </div>

      <div
        className={cn('flex flex-wrap items-baseline gap-2', compact ? 'mt-2.5 md:mt-3' : 'mt-3')}
      >
        <span
          className={cn(
            'text-text-primary',
            compact ? 'text-touch-figure md:text-console-figure-sm' : 'text-console-figure-sm',
          )}
          data-mono
        >
          {valeur}
        </span>
        {variation !== null && variation !== undefined && <PiluleVariation variation={variation} />}
      </div>

      {comparaison && (
        // Bornee a deux lignes en mode resserre : « 286 eleves sur 481 places,
        // 14 classes » tient sur une ligne a 390px de large, sur trois dans
        // une colonne de 170px, et la carte voisine ne suit pas cette hauteur.
        <p
          className={cn(
            'text-text-secondary',
            compact
              ? 'mt-1.5 line-clamp-2 text-touch-meta md:mt-2 md:line-clamp-none md:text-body-sm'
              : 'mt-2 text-body-sm',
          )}
        >
          {comparaison}
        </p>
      )}
    </>
  );

  const classes = cn(
    'block rounded-2xl border border-surface-border bg-surface-container-lowest',
    compact ? 'p-3.5 md:p-5' : 'p-5',
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          classes,
          'group transition-all duration-200',
          'hover:-translate-y-0.5 hover:border-primary-container/35 hover:shadow-floating',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        )}
      >
        {contenu}
      </Link>
    );
  }
  return <div className={classes}>{contenu}</div>;
}

/**
 * Pilule de variation : fleche + signe + pourcentage.
 *
 * Le ton `sombre` sert au bandeau de la console. Les fonds clairs du ton par
 * defaut y disparaitraient, et le rouge du systeme (#ba1a1a) descend sous le
 * seuil de contraste une fois pose sur du bleu nuit.
 */
export function PiluleVariation({
  variation,
  ton = 'clair',
}: {
  variation: number;
  ton?: 'clair' | 'sombre';
}) {
  const monte = variation > 0;
  const plat = variation === 0;
  const Fleche = monte ? ArrowUpRight : ArrowDownRight;
  const sombre = ton === 'sombre';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-body-sm font-medium',
        sombre && 'bg-white/10',
        plat && (sombre ? 'text-white/70' : 'bg-surface-container text-text-secondary'),
        monte && (sombre ? 'text-tertiary-fixed' : 'bg-tertiary-fixed/60 text-tertiary'),
        !monte && !plat && (sombre ? 'text-[#ffb4ab]' : 'bg-error-container text-error'),
      )}
      data-mono
    >
      {!plat && <Fleche className="h-3.5 w-3.5" aria-hidden />}
      {monte ? '+' : ''}
      {variation} %
    </span>
  );
}

export interface SegmentRepartition {
  libelle: string;
  valeur: number;
  /** Couleur de la barre. Teintes validees, voir `anneau-repartition`. */
  couleur: string;
}

/**
 * Repartition en une barre empilee, legende dessous.
 *
 * Cinq colonnes cote a cote se chevauchaient des que la carte retrecissait :
 * « Suspendues » et « Sans abonnement » se touchaient, et aucune troncature
 * n'aurait sauve des libelles qui sont precisement l'identite des parts.
 *
 * Une barre empilee dit mieux ce qu'on cherche ici — **la proportion du parc**
 * — et la legende en lignes accepte n'importe quelle longueur de libelle.
 * Chaque part est nommee et chiffree : l'identite ne repose jamais sur la
 * couleur seule.
 */
export function BarresRepartition({ segments }: { segments: SegmentRepartition[] }) {
  const total = segments.reduce((t, s) => t + s.valeur, 0);

  return (
    <div className="flex flex-col gap-4">
      {/* La barre : les parts nulles sont ecartees, un segment de largeur zero
          n'affichant qu'un liseré d'arrondi. */}
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-surface-container">
        {total > 0 &&
          segments
            .filter((s) => s.valeur > 0)
            .map((s) => (
              <div
                key={s.libelle}
                className="h-full first:rounded-l-full last:rounded-r-full"
                style={{
                  width: `${(s.valeur / total) * 100}%`,
                  backgroundColor: s.couleur,
                }}
                title={`${s.libelle} : ${s.valeur}`}
              />
            ))}
      </div>

      <ul className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
        {segments.map((s) => (
          <li key={s.libelle} className="flex items-center gap-2.5">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: s.couleur }}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate text-body-sm text-text-secondary">
              {s.libelle}
            </span>
            <span className="shrink-0 text-body-md font-semibold text-text-primary" data-mono>
              {s.valeur}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

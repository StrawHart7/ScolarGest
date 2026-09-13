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
      {/*
        Pastille a gauche, intitule a sa droite, rien d'autre sur la ligne.

        La version precedente mettait l'intitule a gauche et un bloc
        « fleche + pastille » a droite, avec l'intitule en capitales espacees
        (`console-eyebrow`, 11px, 0,09em). Deux defauts s'additionnaient, et
        l'utilisateur les a vus en premier — les etiquettes cassaient sur deux
        lignes et la rangee poussait le reste de la page hors de l'ecran.

        Mesure a 1280px CSS (soit 1920 physiques a 150 %, le reglage par defaut
        de beaucoup de portables), carte de 231px :

          budget de l'intitule, ancienne disposition : 121px
          « ENCAISSE CETTE ANNEE » en capitales       : 154px  -> deux lignes
          « Encaissé cette année » en casse normale   : 132px  -> deux lignes
          budget, pastille a gauche et sans fleche    : 132px  -> une ligne

        Les capitales etaient donc le gros du probleme — plus larges de 17 a
        25 % que la casse normale malgre un corps plus petit — mais **pas la
        totalite** : la casse normale seule ne suffisait pas, et ne gagnait
        aucun pixel de hauteur. Il fallait aussi rendre a l'intitule la place
        que le bloc d'icones lui prenait.

        La fleche `ArrowUpRight` disparait : c'est elle qui coutait les 24px
        manquants. Ce qu'elle disait — « cette carte mene quelque part » — est
        deja dit par le soulevement au survol, la bordure qui se teinte et
        l'anneau de focus. Elle avait deja coute un defaut, documente plus haut
        dans l'historique de ce fichier : posee en absolu elle chevauchait la
        ligne de comparaison, posee dans la rangee elle flottait au milieu.
      */}
      <div className={cn('flex items-center gap-2.5', compact && 'max-md:min-h-[36px]')}>
        <span
          className={cn('shrink-0 rounded-lg', PASTILLE[ton], compact ? 'p-1.5 md:p-2' : 'p-2')}
        >
          <Icone className="h-4 w-4" aria-hidden />
        </span>
        {/*
          Casse normale, pas un cartouche. `DESIGN.md` reserve
          `label-md uppercase` aux **en-tetes de colonnes** ; c'est la meme
          regle que celle deja ecrite pour les etiquettes de formulaire, et
          elle vaut ici pour la meme raison.

          La hauteur est reservee pour deux lignes en mode resserre : dans une
          grille a deux colonnes sur telephone, « Encaissé cette année » se
          coupe la ou « Écoles » tient sur une, et les deux chiffres ne
          partageraient plus la meme ligne de base.
        */}
        <p className="min-w-0 text-body-sm font-medium text-text-secondary">{label}</p>
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

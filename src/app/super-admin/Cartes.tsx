import Link from 'next/link';
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Cartes du tableau de bord plateforme.
 *
 * **Propres au SUPER_ADMIN, volontairement.** `StatCard` est partagee par les
 * quatre tableaux de bord d'ecole ; la retoucher pour styliser cette page
 * deplacerait des ecrans qui conviennent tels quels. Le prix est une poignee de
 * classes en double, ce qui est moins cher qu'une regression sur quatre pages.
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
 */

type Ton = 'primaire' | 'succes' | 'alerte' | 'neutre';

const PASTILLE: Record<Ton, string> = {
  primaire: 'bg-primary-fixed text-primary-container',
  succes: 'bg-tertiary-fixed/60 text-tertiary',
  alerte: 'bg-amber-100 text-amber-700',
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
}

export function CarteMetrique({
  label,
  valeur,
  icone: Icone,
  ton = 'primaire',
  variation,
  comparaison,
  href,
}: CarteMetriqueProps) {
  const contenu = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-body-sm font-medium text-text-secondary">{label}</p>
        <span className={cn('shrink-0 rounded-xl p-2', PASTILLE[ton])}>
          <Icone className="h-4 w-4" aria-hidden />
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-baseline gap-2">
        <span
          className="text-[26px] font-semibold leading-none tracking-tight text-text-primary"
          data-mono
        >
          {valeur}
        </span>
        {variation !== null && variation !== undefined && (
          <PiluleVariation variation={variation} />
        )}
      </div>

      {comparaison && (
        <p className="mt-2 text-body-sm text-text-secondary">{comparaison}</p>
      )}
    </>
  );

  const classes =
    'block rounded-2xl border border-surface-border bg-surface-container-lowest p-5 transition-shadow';

  if (href) {
    return (
      <Link href={href} className={cn(classes, 'hover:shadow-subtle')}>
        {contenu}
      </Link>
    );
  }
  return <div className={classes}>{contenu}</div>;
}

/** Pilule de variation : fleche + signe + pourcentage. */
export function PiluleVariation({ variation }: { variation: number }) {
  const monte = variation > 0;
  const plat = variation === 0;
  const Fleche = monte ? ArrowUpRight : ArrowDownRight;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-body-sm font-medium',
        plat && 'bg-surface-container text-text-secondary',
        monte && 'bg-tertiary-fixed/60 text-tertiary',
        !monte && !plat && 'bg-error-container text-error',
      )}
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
 * Repartition en colonnes, chacune surlignee de sa couleur.
 *
 * Reprend le motif « Customers » de la reference : le chiffre porte
 * l'information, la barre situe la proportion, et le libelle nomme la part.
 * Preferee a un anneau ici parce que les etats d'ecole sont **cinq** — un
 * anneau a cinq parts devient un jeu de devinettes.
 */
export function BarresRepartition({ segments }: { segments: SegmentRepartition[] }) {
  const max = Math.max(1, ...segments.map((s) => s.valeur));

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 lg:grid-cols-5">
      {segments.map((s) => (
        <div key={s.libelle} className="min-w-0">
          <p className="text-headline-md text-text-primary" data-mono>
            {s.valeur}
          </p>
          {/* Pas de troncature : « Sans abo… » n'apprend rien, et ces libelles
              sont l'identite de la part. On les laisse passer a la ligne. */}
          <p className="mt-0.5 text-label-md leading-tight text-text-secondary">{s.libelle}</p>
          {/* Piste toujours visible : une part a zero doit occuper sa place
              dans la rangee, sinon la lecture se decale. */}
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-container">
            <div
              className="h-full rounded-full"
              style={{
                width: `${(s.valeur / max) * 100}%`,
                backgroundColor: s.couleur,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

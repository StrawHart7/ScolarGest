import Link from 'next/link';
import { ArrowRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Carte de tête d'un écran : ce qu'il y a à faire, pas ce qu'il y a à savoir.
 *
 * Relevé du 2026-09-04 : le tableau de bord Enseignant consacrait 40 % de son
 * premier écran à quatre nombres d'un seul caractère, et la seule chose
 * actionnable — « 38 notes en brouillon à soumettre » — arrivait en troisième
 * position, hors de l'écran d'ouverture sur un téléphone de 844px. Celui du
 * Directeur ouvrait sur onze lignes « Bulletin généré · il y a 2 j »
 * identiques.
 *
 * Cette carte est donc l'unique élément de marque d'un écran : dégradé plein,
 * texte blanc, un chiffre en chasse fixe et une seule action. Elle ne se
 * répète pas — deux cartes de marque sur un écran, et plus aucune ne dit
 * « regarde ici ». Les compteurs vivent en dessous, dans `GrilleCompteurs`.
 *
 * `valeur` est un texte et non un nombre : les écrans en affichent aussi bien
 * « 38 notes » que « 69 % » ou un montant déjà formaté en FCFA. Le formatage
 * appartient à l'appelant, qui seul sait de quoi il parle.
 */
export interface CarteActionProps {
  /** Ce que le chiffre mesure, en une ligne courte. */
  intitule: string;
  /** Déjà formaté par l'appelant. */
  valeur: string;
  /** Précision sous le chiffre — un reste à recouvrer, une échéance. */
  precision?: string;
  action?: { libelle: string; href: string };
  /** Illustration discrète, en filigrane à droite. Jamais porteuse de sens. */
  icone?: LucideIcon;
  /** Contenu libre à droite du chiffre : un anneau, une jauge. */
  aside?: React.ReactNode;
  className?: string;
}

export function CarteAction({
  intitule,
  valeur,
  precision,
  action,
  icone: Icone,
  aside,
  className,
}: CarteActionProps) {
  return (
    <section
      className={cn(
        // `flex flex-col` : la carte sert aussi de colonne etiree, posee sous
        // « Recouvrement » a cote d'une colonne d'activite plus haute. Sans
        // elle, le contenu resterait colle en haut et l'etirement produirait
        // exactement le vide qu'on cherchait a combler.
        'relative flex flex-col overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary-container p-5 text-white shadow-subtle',
        className,
      )}
    >
      {Icone && (
        <Icone
          className="pointer-events-none absolute -right-4 -top-4 h-28 w-28 text-white/10"
          aria-hidden
        />
      )}

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-touch-meta text-white/75">{intitule}</p>
          <p className="mt-1 text-touch-figure text-white" data-mono>
            {valeur}
          </p>
          {precision && <p className="mt-1.5 text-touch-meta text-white/75">{precision}</p>}
        </div>
        {aside && <div className="shrink-0">{aside}</div>}
      </div>

      {action && (
        // Pastille blanche sur le dégradé : c'est le seul endroit de
        // l'application où l'action principale n'est pas bleue, parce qu'ici
        // le bleu est le fond. `h-row-standard` tient la cible tactile de
        // 44px, que les boutons `size="sm"` (32px) ne tenaient pas.
        <Link
          href={action.href}
          // `mt-auto` plutot que `mt-4` : quand la carte est etiree, l'action
          // descend au bas plutot que de laisser le blanc sous elle. Le
          // `mt-4` reste le minimum quand la carte tient sa hauteur naturelle.
          className="relative mt-4 inline-flex h-row-standard items-center gap-2 self-start rounded-full bg-white px-5 text-touch-label text-primary transition-colors hover:bg-primary-fixed md:mt-auto"
        >
          {action.libelle}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      )}
    </section>
  );
}

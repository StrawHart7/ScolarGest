import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Lien de remontée d'une sous-page vers sa page parente.
 *
 * La sidebar ne montre que les destinations de premier niveau : une fois sur
 * une sous-page (fiche d'élève, tarifs, import…), rien n'indiquait par où
 * remonter, et le bouton « précédent » du navigateur ne dit pas *où* il mène.
 * Le motif existait déjà, recopié à l'identique dans une dizaine de fiches ;
 * il est ici factorisé pour que toutes les sous-pages le portent de la même
 * façon.
 *
 * Le libellé nomme la destination (« Retour aux élèves »), jamais un simple
 * « Retour » : c'est le nom qui permet de décider si l'on veut y aller.
 */
export function LienRetour({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        // `min-h-row-standard` sous `md` : le lien mesurait 24px de haut,
        // et c'est la premiere chose qu'on cherche a toucher en arrivant sur
        // une sous-page. `-ml-1 px-1` compense le rembourrage pour que le
        // texte reste aligne sur le contenu de la page.
        'inline-flex min-h-row-standard items-center gap-1.5 -ml-1 px-1 text-body-sm text-text-secondary transition-colors hover:text-text-primary md:min-h-0 md:ml-0 md:px-0',
        className,
      )}
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      {children}
    </Link>
  );
}

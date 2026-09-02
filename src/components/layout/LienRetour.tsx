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
        'inline-flex items-center gap-1.5 text-body-sm text-text-secondary transition-colors hover:text-text-primary',
        className,
      )}
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      {children}
    </Link>
  );
}

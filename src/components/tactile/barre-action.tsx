import { cn } from '@/lib/utils';

/**
 * Barre d'action collée en bas de l'écran, sur téléphone uniquement.
 *
 * Relevé du 2026-09-04 : le formulaire de création d'élève fait 2 008px de haut
 * et son bouton « Enregistrer l'élève » se trouve tout en bas, aligné à droite.
 * Pour l'atteindre il faut avoir traversé quinze champs — et pour vérifier
 * qu'il existe, il faut y aller. Sur un écran de 844px, une action qu'on ne
 * voit jamais est une action qu'on croit absente.
 *
 * La barre reprend donc l'action principale et la rend visible en permanence.
 * Trois contraintes tenues :
 *
 * - **Elle passe au-dessus de la barre d'onglets**, qui flotte à 24px du bas et
 *   fait 56px : `bottom-[calc(...)]` la pose juste au-dessus, encoche comprise.
 *   Sans cela l'action principale de la page serait recouverte par la
 *   navigation — le défaut qu'on prétend corriger, déplacé d'un cran.
 * - **La page doit dégager la hauteur correspondante** : `zone-action` existe
 *   pour ça dans l'échelle, à poser en `pb-` sur le conteneur du formulaire.
 *   Le composant ne peut pas le faire lui-même, il est en `fixed`.
 * - **Le bouton d'origine reste dans le flux**, masqué sous `md` par
 *   l'appelant. On ne déplace pas la soumission : on la double. Un formulaire
 *   dont le bouton n'existe que dans une barre flottante devient insoumettable
 *   si cette barre est masquée par un clavier virtuel mal mesuré.
 */
export function BarreAction({
  children,
  aide,
  className,
}: {
  /** L'action principale, et elle seule. Une barre à deux boutons n'en a plus. */
  children: React.ReactNode;
  /** Une ligne d'explication sous le bouton — état, conséquence, réversibilité. */
  aide?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] z-30 px-gutter md:hidden',
        className,
      )}
    >
      <div className="rounded-xl border border-surface-border bg-surface-container-lowest/95 p-3 shadow-floating backdrop-blur-md">
        {children}
        {aide && <p className="mt-2 text-center text-touch-meta text-text-secondary">{aide}</p>}
      </div>
    </div>
  );
}

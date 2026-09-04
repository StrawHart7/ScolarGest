import { cn } from '@/lib/utils';
import { CarteMetrique, type CarteMetriqueProps } from '@/components/ui/carte-metrique';

/**
 * Grille de compteurs — deux colonnes sur téléphone, quatre au-delà.
 *
 * Les cinq tableaux de bord écrivaient tous la même classe à la main,
 * `grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4`. Sur un téléphone de
 * 390px, `grid-cols-1` donne quatre cartes pleine largeur d'environ 130px de
 * haut : 550px de défilement pour quatre nombres, dont deux à un seul
 * caractère (« 5 classes », « 5 matières »). Un nombre n'a pas besoin de
 * 390px pour être lisible ; il a besoin d'être comparable à son voisin, ce
 * que deux colonnes donnent et une seule interdit.
 *
 * `CLAUDE.md` documentait déjà `grid-cols-2` comme base mobile. C'était vrai
 * pour `StatCard` et faux pour les tableaux de bord, qui utilisent
 * `CarteMetrique`. Ce composant supprime l'écart plutôt que la note.
 *
 * Les données passent en `items` et non en enfants : c'est la seule façon de
 * garantir que toutes les cartes d'une grille reçoivent le même traitement,
 * et ça permet d'en compter le nombre pour choisir la disposition.
 */
export function GrilleCompteurs({
  items,
  className,
}: {
  items: CarteMetriqueProps[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-3 md:gap-4',
        // Trois compteurs tiennent sur une ligne au large ; quatre aussi. Au
        // delà de quatre on reste à quatre par ligne plutôt que d'étirer.
        items.length === 3 ? 'xl:grid-cols-3' : 'xl:grid-cols-4',
        className,
      )}
    >
      {items.map((item) => (
        <CarteMetrique key={item.label} {...item} compact />
      ))}
    </div>
  );
}

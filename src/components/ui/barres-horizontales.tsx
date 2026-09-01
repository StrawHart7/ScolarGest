import { cn } from '@/lib/utils';

/**
 * Barres horizontales : un libelle, une barre, une valeur.
 *
 * Horizontales et non verticales parce que les libelles sont des **noms** —
 * « 6ème A », « Tle D1 » — et non des mois. Un nom de classe pose sous une
 * colonne verticale se lit de travers ou se tronque ; pose a gauche d'une
 * barre, il se lit normalement, quelle que soit sa longueur.
 *
 * Quand une capacite est connue, la barre la represente : la longueur dit le
 * **taux de remplissage**, pas l'effectif brut. Une classe de 25 eleves sur 25
 * places est pleine, une de 30 sur 60 ne l'est pas, et c'est cette difference
 * qui appelle une decision. Sans capacite renseignee, on retombe sur l'effectif
 * rapporte au plus grand — faute de mieux, et signale par une teinte neutre.
 */

export interface LigneBarre {
  id: string;
  libelle: string;
  valeur: number;
  /** Reference pour le remplissage. `null` si inconnue. */
  reference: number | null;
}

/** Au-dela, la barre passe a l'ambre : la classe deborde sa capacite. */
const SEUIL_ALERTE = 1;

export function BarresHorizontales({
  lignes,
  largeurLibelle = 'w-20',
  className,
}: {
  lignes: LigneBarre[];
  /**
   * Largeur de la colonne de libelles, en classe Tailwind.
   *
   * Reglable parce que les libelles varient du tout au tout : « 6ème A » tient
   * dans 5rem, « Très insuffisant et moins » non — et une troncature sur une
   * tranche de notes rend la lecture impossible.
   */
  largeurLibelle?: string;
  className?: string;
}) {
  const maxValeur = Math.max(1, ...lignes.map((l) => l.valeur));

  return (
    <ul className={cn('flex flex-col gap-3', className)}>
      {lignes.map((ligne) => {
        const aReference = ligne.reference !== null && ligne.reference > 0;
        const ratio = aReference ? ligne.valeur / ligne.reference! : ligne.valeur / maxValeur;
        const deborde = aReference && ratio > SEUIL_ALERTE;

        return (
          <li key={ligne.id} className="flex items-center gap-3">
            <span
              className={cn(
                'shrink-0 truncate text-body-sm text-text-secondary',
                largeurLibelle,
              )}
            >
              {ligne.libelle}
            </span>

            <span className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-container">
              <span
                className={cn(
                  'block h-full rounded-full',
                  !aReference && 'bg-outline',
                  aReference && !deborde && 'bg-primary-container',
                  deborde && 'bg-amber-500',
                )}
                // Une classe qui deborde ne doit pas faire deborder la barre :
                // la teinte porte l'alerte, la longueur reste bornee.
                style={{ width: `${Math.min(100, ratio * 100)}%` }}
              />
            </span>

            <span className="w-16 shrink-0 text-right text-body-sm text-text-primary" data-mono>
              {ligne.valeur}
              {aReference && (
                <span className="text-text-secondary">/{ligne.reference}</span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

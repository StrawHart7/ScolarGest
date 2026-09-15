import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * Un seul écran de suivi, deux façons de le lire.
 *
 * « Suivi des paiements » et « Versements » étaient deux entrées de menu, et
 * l'une des deux mentait : elle annonçait « encaisser un versement et éditer le
 * reçu » alors que la page est en lecture seule — son propre état vide renvoie
 * à la facture de l'élève.
 *
 * Elles ne font pourtant pas double emploi, et c'est pour ça qu'aucune n'est
 * supprimée. **Par élève** répond à « qui me doit encore quelque chose », la
 * question du recouvrement. **Par versement** est le journal de caisse : ce qui
 * est rentré aujourd'hui, la recherche par numéro de reçu — qu'on ne peut pas
 * faire depuis la fiche d'un élève, puisqu'on cherche justement lequel — et les
 * versements annulés, qu'on regarde quand la caisse ne tombe pas juste.
 *
 * Deux vues d'un même écran plutôt que deux écrans : une entrée de menu, un
 * basculement au lieu d'une navigation.
 */
const VUES = [
  { href: '/etablissement/finances/factures', libelle: 'Par élève' },
  { href: '/etablissement/finances/paiements', libelle: 'Par versement' },
] as const;

export function VuesPaiements({ actif }: { actif: string }) {
  return (
    <nav
      className="flex gap-1 overflow-x-auto rounded-lg bg-surface-container p-1"
      aria-label="Vue"
    >
      {VUES.map((vue) => {
        const courante = vue.href === actif;
        return (
          <Link
            key={vue.href}
            href={vue.href}
            aria-current={courante ? 'page' : undefined}
            className={cn(
              'flex h-row-standard flex-1 items-center justify-center whitespace-nowrap rounded-md px-4 text-body-md transition-colors md:h-9',
              courante
                ? 'bg-surface-container-lowest font-semibold text-text-primary shadow-sm'
                : 'text-text-secondary hover:text-text-primary',
            )}
          >
            {vue.libelle}
          </Link>
        );
      })}
    </nav>
  );
}

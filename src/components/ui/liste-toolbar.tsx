'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { Spinner } from './spinner';
import { TableHead } from './table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';

/**
 * Barre d'outils de liste (recherche, filtres) et pagination, pilotées par les
 * `searchParams` de l'URL : les pages restent des Server Components, la
 * sélection est partageable et survit à un rechargement.
 */

function useMajParametres() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [enAttente, demarrerTransition] = React.useTransition();

  const majParametres = React.useCallback(
    (modifications: Record<string, string | undefined>, options?: { garderPage?: boolean }) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [cle, valeur] of Object.entries(modifications)) {
        if (valeur === undefined || valeur === '') params.delete(cle);
        else params.set(cle, valeur);
      }
      // Toute modification de recherche, de tri ou de filtre invalide la page
      // courante : rester en page 4 d'un résultat qui n'en compte plus qu'une
      // affiche un tableau vide sans explication.
      if (!options?.garderPage) params.delete('page');
      const requete = params.toString();
      demarrerTransition(() => {
        router.replace(requete ? `${pathname}?${requete}` : pathname, { scroll: false });
      });
    },
    [pathname, router, searchParams],
  );

  return { majParametres, enAttente, searchParams };
}

export function RechercheListe({
  placeholder = 'Rechercher…',
  className,
}: {
  placeholder?: string;
  className?: string;
}) {
  const { majParametres, enAttente, searchParams } = useMajParametres();
  const [valeur, setValeur] = React.useState(searchParams.get('q') ?? '');
  const premierRendu = React.useRef(true);

  // Recherche dynamique : on attend une pause de frappe plutôt que de lancer
  // une requête serveur à chaque caractère.
  React.useEffect(() => {
    if (premierRendu.current) {
      premierRendu.current = false;
      return;
    }
    const minuteur = setTimeout(() => majParametres({ q: valeur || undefined }), 300);
    return () => clearTimeout(minuteur);
  }, [valeur, majParametres]);

  return (
    <div className={cn('relative w-full sm:w-72', className)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary"
        aria-hidden
      />
      <input
        type="search"
        value={valeur}
        onChange={(e) => setValeur(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-10 w-full rounded border border-surface-border bg-surface-container-lowest pl-9 pr-9 text-body-md text-text-primary transition-colors placeholder:text-text-secondary/60 hover:border-primary-container/40 focus-visible:border-primary-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container/20 [&::-webkit-search-cancel-button]:hidden"
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2">
        {enAttente ? (
          <Spinner className="h-4 w-4 text-text-secondary" />
        ) : valeur ? (
          <button
            type="button"
            onClick={() => setValeur('')}
            aria-label="Effacer la recherche"
            className="text-text-secondary transition-colors hover:text-text-primary"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </span>
    </div>
  );
}

export interface OptionFiltre {
  valeur: string;
  libelle: string;
}

export function FiltreListe({
  parametre,
  libelle,
  options,
  libelleTout = 'Tous',
  className,
}: {
  parametre: string;
  libelle: string;
  options: OptionFiltre[];
  libelleTout?: string;
  className?: string;
}) {
  const { majParametres, searchParams } = useMajParametres();
  // Radix Select n'accepte pas la chaîne vide comme valeur d'item : on encode
  // « pas de filtre » par un jeton explicite.
  const TOUT = '__tout__';
  const courant = searchParams.get(parametre) || TOUT;
  const id = React.useId();

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <label htmlFor={id} className="whitespace-nowrap text-label-md text-text-secondary">
        {libelle}
      </label>
      <Select
        value={courant}
        onValueChange={(valeur) =>
          majParametres({ [parametre]: valeur === TOUT ? undefined : valeur })
        }
      >
        <SelectTrigger id={id} className="h-10 w-auto min-w-[10rem] gap-2">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TOUT}>{libelleTout}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.valeur} value={option.valeur}>
              {option.libelle}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** En-tête de colonne cliquable : bascule tri croissant / décroissant. */
export function TriColonne({
  cle,
  children,
  numerique,
}: {
  cle: string;
  children: React.ReactNode;
  numerique?: boolean;
}) {
  const { majParametres, searchParams } = useMajParametres();
  const triCourant = searchParams.get('tri');
  const sens = searchParams.get('sens') === 'desc' ? 'desc' : 'asc';
  const actif = triCourant === cle;

  return (
    <TableHead className={numerique ? 'text-right' : undefined}>
      <button
        type="button"
        onClick={() =>
          majParametres({ tri: cle, sens: actif && sens === 'asc' ? 'desc' : 'asc' })
        }
        aria-label={`Trier par ${String(children)}`}
        className={cn(
          'inline-flex items-center gap-1 rounded px-1 py-0.5 text-label-md uppercase tracking-wide transition-colors',
          actif
            ? 'text-primary-container'
            : 'text-text-secondary hover:bg-surface-container hover:text-text-primary',
        )}
      >
        {children}
        {actif ? (
          sens === 'asc' ? (
            <ArrowUp className="h-3 w-3" aria-hidden />
          ) : (
            <ArrowDown className="h-3 w-3" aria-hidden />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" aria-hidden />
        )}
      </button>
    </TableHead>
  );
}

export function PaginationListe({
  page,
  nombrePages,
  debut,
  fin,
  total,
  libelle = 'élément(s)',
}: {
  page: number;
  nombrePages: number;
  debut: number;
  fin: number;
  total: number;
  libelle?: string;
}) {
  const { majParametres, enAttente } = useMajParametres();
  if (total === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-surface-border px-4 py-3">
      <p className="text-body-sm text-text-secondary">
        {debut}–{fin} sur {total} {libelle}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={page <= 1 || enAttente}
          onClick={() => majParametres({ page: String(page - 1) }, { garderPage: true })}
          aria-label="Page précédente"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Précédent
        </Button>
        <span className="px-1 text-body-sm text-text-secondary">
          Page {page} / {nombrePages}
        </span>
        <Button
          variant="secondary"
          size="sm"
          disabled={page >= nombrePages || enAttente}
          onClick={() => majParametres({ page: String(page + 1) }, { garderPage: true })}
          aria-label="Page suivante"
        >
          Suivant
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}

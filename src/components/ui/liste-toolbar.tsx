'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Spinner } from './spinner';
import { TableHead } from './table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';

/**
 * Barre d'outils de liste (recherche, filtres) et pagination, pilotées par les
 * `searchParams` de l'URL : les pages restent des Server Components, la
 * sélection est partageable et survit à un rechargement.
 */

/**
 * Ecriture des parametres de liste dans l'URL. Exporte parce que `BarreListe`
 * en depend : dupliquer cette logique ferait diverger deux facons d'ecrire
 * `page`, `tri` et `sens`.
 */
export function useParametresListe() {
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
  const { majParametres, enAttente, searchParams } = useParametresListe();
  const termeUrl = searchParams.get('q') ?? '';
  const [valeur, setValeur] = React.useState(termeUrl);

  // Recherche dynamique : on attend une pause de frappe plutôt que de lancer
  // une requête serveur à chaque caractère.
  //
  // La comparaison avec le terme présent dans l'URL n'est pas une optimisation,
  // c'est la condition de sortie. `majParametres` se reconstruit à chaque
  // changement de `searchParams` — donc à chaque navigation, pagination
  // comprise. Sans cette garde, cliquer sur « suivant » relançait l'effet, qui
  // réécrivait `q` et, ce faisant, effaçait `page` : on retombait aussitôt sur
  // la première page. On ne repart donc que si la saisie diverge réellement de
  // l'URL, c'est-à-dire quand l'utilisateur a tapé quelque chose.
  React.useEffect(() => {
    if (valeur === termeUrl) return;
    const minuteur = setTimeout(() => majParametres({ q: valeur || undefined }), 300);
    return () => clearTimeout(minuteur);
  }, [valeur, termeUrl, majParametres]);

  return (
    // Sous `md` la recherche occupe toute la largeur restante de la barre
    // d'outils, à côté du filtre et de l'action ; au-delà elle reprend sa
    // largeur fixe pour ne pas écarter les filtres alignés à sa droite.
    <div className={cn('relative min-w-0 flex-1 md:w-72 md:flex-none', className)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-outline md:h-4 md:w-4 md:text-text-secondary"
        aria-hidden
      />
      <input
        type="search"
        value={valeur}
        onChange={(e) => setValeur(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-row-standard w-full rounded-lg border border-surface-border bg-surface-container-lowest pl-10 pr-9 text-body-md md:h-10 text-text-primary shadow-sm transition-colors placeholder:text-outline-variant hover:border-primary-container/40 focus-visible:border-primary-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container/20 md:pl-9 md:shadow-none [&::-webkit-search-cancel-button]:hidden"
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

/**
 * Champ de recherche a filtrage local.
 *
 * `RechercheListe` ecrit dans l'URL et fait refiltrer le serveur ; c'est le bon
 * choix pour une liste paginee cote serveur. Certaines listes sont deja
 * chargees entierement dans le navigateur — la classe entiere sur les ecrans de
 * bulletins — et un aller-retour serveur n'y aurait rien a filtrer de plus.
 * Meme apparence, etat local.
 */
export function RechercheLocale({
  valeur,
  onChange,
  placeholder = 'Rechercher…',
  className,
}: {
  valeur: string;
  onChange: (valeur: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn('relative min-w-0 flex-1 md:w-72 md:flex-none', className)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-outline md:h-4 md:w-4 md:text-text-secondary"
        aria-hidden
      />
      <input
        type="search"
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-row-standard w-full rounded-lg border border-surface-border bg-surface-container-lowest pl-10 pr-9 text-body-md md:h-10 text-text-primary shadow-sm transition-colors placeholder:text-outline-variant hover:border-primary-container/40 focus-visible:border-primary-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container/20 md:pl-9 md:shadow-none [&::-webkit-search-cancel-button]:hidden"
      />
      {valeur && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Effacer la recherche"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary transition-colors hover:text-text-primary"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      )}
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
  const { majParametres, searchParams } = useParametresListe();
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
  const { majParametres, searchParams } = useParametresListe();
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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Les flèches sont des liens, pas des boutons : Next précharge alors la page
  // voisine au survol, si bien que le clic n'attend plus le serveur. Un
  // `onClick` ne lui donne aucune cible à préparer à l'avance.
  const lienVers = (cible: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (cible <= 1) params.delete('page');
    else params.set('page', String(cible));
    const requete = params.toString();
    return requete ? `${pathname}?${requete}` : pathname;
  };

  if (total === 0) return null;

  const precedentInactif = page <= 1;
  const suivantInactif = page >= nombrePages;

  const compteur = (
    <>
      {debut}–{fin} sur {total} {libelle}
    </>
  );

  return (
    // Sous `md`, la liste est une carte autonome : un filet supérieur pleine
    // largeur flotterait sous elle sans rien séparer. La pagination y devient
    // une simple rangée détachée.
    <div className="px-1 py-1 md:border-t md:border-surface-border md:px-4 md:py-3">
      {/*
        Téléphone : une seule commande, pleine largeur.

        Trois objets flottant au bas d'un écran de 390px — un compteur, deux
        boutons bordés — ne forment pas une commande, ils forment un reste. La
        barre les réunit : une piste claire, les deux flèches en pastilles blanches
        à ses extrémités, la page au milieu. C'est le même objet que la liste
        au-dessus, à la même largeur, et le pouce n'a plus à viser.

        L'inventaire passe sous la barre, en gris et centré : c'est une indication,
        pas une commande, et il ne mérite pas la moitié de la rangée.
      */}
      <div className="md:hidden">
        <div className="flex items-center justify-between gap-2 rounded-full bg-surface-container p-1">
          <FlechePage
            href={lienVers(page - 1)}
            inactif={precedentInactif}
            libelle="Page précédente"
            icone={ChevronLeft}
            pastille
          />
          <span className="text-body-sm font-medium tabular-nums text-text-primary">
            Page {page} sur {nombrePages}
          </span>
          <FlechePage
            href={lienVers(page + 1)}
            inactif={suivantInactif}
            libelle="Page suivante"
            icone={ChevronRight}
            pastille
          />
        </div>
        <p className="mt-2 text-center text-body-sm text-text-secondary">{compteur}</p>
      </div>

      {/* Bureau : la rangée tient dans la largeur, elle la garde. */}
      <div className="hidden items-center justify-between gap-3 md:flex">
        <p className="text-body-sm text-text-secondary">{compteur}</p>

        {/*
        Deux flèches et un compteur, sans boîte.

        C'était deux boutons bordés côte à côte, « Précédent » et « Suivant », qui
        pesaient dans le bas de page autant que les rangées de la liste au-dessus —
        pour une commande qui ne sert que si on ne trouve pas ce qui est déjà à
        l'écran. Une flèche de part et d'autre de « Page 1 / 30 » dit la même chose
        et ne dispute rien à la liste.

        Les libellés ne sont pas perdus : ils vivent en `aria-label`, seule forme
        dont un lecteur d'écran ait besoin.
        */}
        <div className="flex shrink-0 items-center gap-1">
          <FlechePage
            href={lienVers(page - 1)}
            inactif={precedentInactif}
            libelle="Page précédente"
            icone={ChevronLeft}
          />
          <span className="px-1 text-body-sm tabular-nums text-text-secondary">
            Page {page} / {nombrePages}
          </span>
          <FlechePage
            href={lienVers(page + 1)}
            inactif={suivantInactif}
            libelle="Page suivante"
            icone={ChevronRight}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Une flèche de pagination : cible tactile pleine, fond qui n'apparaît qu'au
 * survol.
 *
 * 44px sous `md` et 36px au-delà, comme le reste du produit : le plancher tactile
 * ne vaut que pour le doigt. Inactive, elle reste à sa place et perd sa couleur —
 * la retirer ferait sauter le compteur d'un côté à l'autre à la première et à la
 * dernière page.
 */
function FlechePage({
  href,
  inactif,
  libelle,
  icone: Icone,
  pastille,
}: {
  href: string;
  inactif: boolean;
  libelle: string;
  icone: typeof ChevronLeft;
  /** Présentation de la barre du téléphone : un rond blanc posé sur la piste. */
  pastille?: boolean;
}) {
  const classe = cn(
    'grid h-row-standard w-row-standard shrink-0 place-items-center rounded-full transition-colors',
    !pastille && 'md:h-9 md:w-9',
  );

  // Inactive, la flèche garde sa place et perd sa couleur : la retirer ferait
  // sauter le compteur d'un côté à l'autre à la première et à la dernière page.
  if (inactif) {
    return (
      <span aria-hidden className={cn(classe, "text-outline-variant")}>
        <Icone className="h-[18px] w-[18px]" />
      </span>
    );
  }

  return (
    <Link
      href={href}
      prefetch
      scroll={false}
      aria-label={libelle}
      title={libelle}
      className={cn(
        classe,
        pastille
          ? 'bg-surface-container-lowest text-text-primary shadow-subtle active:bg-surface-container'
          : 'text-text-secondary hover:bg-surface-container hover:text-text-primary active:bg-surface-container-high',
      )}
    >
      <Icone className="h-[18px] w-[18px]" aria-hidden />
    </Link>
  );
}

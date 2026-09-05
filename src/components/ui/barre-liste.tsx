'use client';

import * as React from 'react';
import { ArrowDownUp, Check, SlidersHorizontal, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from './dialog';
import { FiltreListe, RechercheListe, useParametresListe, type OptionFiltre } from './liste-toolbar';

/**
 * En-tete commune a toutes les pages de liste.
 *
 * Chaque liste composait sa propre rangee : les filtres etaient alignes en
 * clair sur certaines pages, replies derriere une icone sur d'autres, et la
 * hauteur de l'en-tete changeait selon le nombre de filtres — trois selects
 * etiquetes occupaient une bande entiere avant meme d'atteindre la liste.
 * Ici la disposition est fixe : recherche a gauche, « Filtres » et « Trier » a
 * droite, actions de page a l'extremite. Seul le *contenu* varie d'une page a
 * l'autre.
 *
 * Les filtres sont decrits par des donnees, pas par du JSX. C'est ce qui
 * permet a ce composant d'afficher lui-meme les pastilles des filtres actifs
 * et d'en compter le nombre : passer des `<FiltreListe/>` deja construits
 * obligerait chaque page a recompter ses filtres de son cote, ce qui est
 * exactement la duplication qu'on retire.
 *
 * Les filtres passent derriere un bouton **y compris sur desktop**. C'est le
 * prix de l'en-tete constante, et la contrepartie est la rangee de pastilles :
 * un filtre actif reste visible et se retire d'un clic, sans ouvrir le
 * panneau.
 */

export interface DescriptionFiltre {
  /** Nom du parametre d'URL pilote par ce filtre. */
  parametre: string;
  libelle: string;
  options: OptionFiltre[];
  /** Libelle de l'option « pas de filtre ». */
  libelleTout?: string;
}

export interface OptionTri {
  /** Valeur ecrite dans le parametre `tri`. */
  cle: string;
  libelle: string;
}

export function BarreListe({
  placeholderRecherche,
  filtres = [],
  filtresLibres,
  nombreFiltresLibresActifs = 0,
  tri,
  actions,
  className,
}: {
  placeholderRecherche?: string;
  filtres?: DescriptionFiltre[];
  /**
   * Filtres metier qu'un descripteur ne peut pas exprimer — typiquement
   * « annee scolaire » puis « classe », ou changer d'annee doit reinitialiser
   * la classe. Ils sont rendus dans le meme panneau, au-dessus des autres.
   */
  filtresLibres?: React.ReactNode;
  /** Combien de `filtresLibres` sont actifs — le composant ne peut pas le deviner. */
  nombreFiltresLibresActifs?: number;
  tri?: OptionTri[];
  /** Boutons propres a la page (import, creation…), a droite de la barre. */
  actions?: React.ReactNode;
  className?: string;
}) {
  const { searchParams } = useParametresListe();
  const [panneauOuvert, setPanneauOuvert] = React.useState(false);

  const actifs = filtres
    .map((filtre) => {
      const valeur = searchParams.get(filtre.parametre);
      if (!valeur) return null;
      const option = filtre.options.find((o) => o.valeur === valeur);
      // Un parametre qui ne correspond a aucune option connue — URL bricolee,
      // filtre retire du catalogue — ne produit pas de pastille muette.
      return option ? { ...filtre, valeurCourante: valeur, libelleValeur: option.libelle } : null;
    })
    .filter((f): f is DescriptionFiltre & { valeurCourante: string; libelleValeur: string } =>
      Boolean(f),
    );

  const nombreActifs = actifs.length + nombreFiltresLibresActifs;

  return (
    <div
      className={cn(
        'rounded-xl border border-surface-border bg-surface-container-lowest p-3 shadow-subtle md:p-4',
        className,
      )}
    >
      <div className="flex items-center gap-2 md:gap-3">
        {placeholderRecherche && (
          <RechercheListe placeholder={placeholderRecherche} className="md:w-80" />
        )}

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {(filtres.length > 0 || filtresLibres) && (
            <BoutonBarre
              onClick={() => setPanneauOuvert(true)}
              icone={SlidersHorizontal}
              libelle="Filtres"
              badge={nombreActifs || undefined}
              actif={nombreActifs > 0}
            />
          )}
          {tri && tri.length > 0 && <MenuTri options={tri} />}
          {actions}
        </div>
      </div>

      {actifs.length > 0 && <PastillesFiltres actifs={actifs} />}

      <Dialog open={panneauOuvert} onOpenChange={setPanneauOuvert}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Filtres</DialogTitle>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-4">
            {filtresLibres}
            {filtres.map((filtre) => (
              <FiltreListe
                key={filtre.parametre}
                parametre={filtre.parametre}
                libelle={filtre.libelle}
                options={filtre.options}
                libelleTout={filtre.libelleTout}
                className="flex-col items-stretch gap-1.5 md:flex-row md:items-center"
              />
            ))}
          </DialogBody>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Bouton de la barre : icone seule sous `md`, icone + libelle au-dela. */
function BoutonBarre({
  onClick,
  icone: Icone,
  libelle,
  badge,
  actif,
}: {
  onClick: () => void;
  icone: React.ComponentType<{ className?: string }>;
  libelle: string;
  badge?: number;
  actif?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={badge ? `${libelle} (${badge} actif${badge > 1 ? 's' : ''})` : libelle}
      className={cn(
        'relative inline-flex h-row-standard shrink-0 items-center gap-2 rounded-lg border px-3 text-body-md transition-colors md:h-10',
        actif
          ? 'border-primary-container bg-primary-fixed text-primary-container'
          : 'border-surface-border bg-surface-container-lowest text-text-secondary hover:border-primary-container/40 hover:text-text-primary',
      )}
    >
      <Icone className="h-4 w-4 shrink-0" />
      <span className="hidden md:inline">{libelle}</span>
      {badge ? (
        <span className="grid h-4 min-w-4 place-items-center rounded-full bg-primary-container px-1 text-[10px] font-bold text-white">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

/**
 * Tri depuis l'en-tete.
 *
 * Il ecrit les memes parametres `tri`/`sens` que les en-tetes de colonne
 * cliquables (`TriColonne`) : les deux commandes restent donc d'accord, et
 * cliquer une colonne met a jour ce menu. Sans lui, une liste n'est triable
 * que par son tableau — donc pas du tout sous `md`, ou le tableau devient des
 * cartes.
 */
function MenuTri({ options }: { options: OptionTri[] }) {
  const { majParametres, searchParams } = useParametresListe();
  const [ouvert, setOuvert] = React.useState(false);
  const triCourant = searchParams.get('tri');
  const sens = searchParams.get('sens') === 'desc' ? 'desc' : 'asc';
  const courante = options.find((o) => o.cle === triCourant);

  return (
    <>
      <BoutonBarre
        onClick={() => setOuvert(true)}
        icone={ArrowDownUp}
        libelle="Trier"
        actif={Boolean(courante)}
      />
      <Dialog open={ouvert} onOpenChange={setOuvert}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Trier par</DialogTitle>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-1">
            {options.map((option) => {
              const actif = option.cle === triCourant;
              return (
                <div key={option.cle} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      majParametres({
                        tri: option.cle,
                        sens: actif && sens === 'asc' ? 'desc' : 'asc',
                      });
                      setOuvert(false);
                    }}
                    className={cn(
                      'flex flex-1 items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-body-md transition-colors',
                      actif
                        ? 'bg-primary-fixed font-semibold text-primary-container'
                        : 'text-text-primary hover:bg-surface-container',
                    )}
                  >
                    {option.libelle}
                    <span className="flex items-center gap-2 text-body-sm text-text-secondary">
                      {actif && (sens === 'asc' ? 'croissant' : 'décroissant')}
                      {actif && <Check className="h-4 w-4 text-primary-container" aria-hidden />}
                    </span>
                  </button>
                </div>
              );
            })}
            {courante && (
              <button
                type="button"
                onClick={() => {
                  majParametres({ tri: undefined, sens: undefined });
                  setOuvert(false);
                }}
                className="mt-2 rounded-lg px-3 py-2.5 text-left text-body-md text-text-secondary transition-colors hover:bg-surface-container hover:text-text-primary"
              >
                Retirer le tri
              </button>
            )}
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Filtres actifs, retirables d'un clic sans rouvrir le panneau. */
function PastillesFiltres({
  actifs,
}: {
  actifs: (DescriptionFiltre & { libelleValeur: string })[];
}) {
  const { majParametres } = useParametresListe();

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-surface-border pt-3">
      {actifs.map((filtre) => (
        <span
          key={filtre.parametre}
          className="inline-flex items-center gap-1.5 rounded-full border border-primary-container/30 bg-primary-fixed px-2.5 py-1 text-body-sm text-primary-container"
        >
          <span className="text-text-secondary">{filtre.libelle}</span>
          <span className="font-semibold">{filtre.libelleValeur}</span>
          <button
            type="button"
            onClick={() => majParametres({ [filtre.parametre]: undefined })}
            aria-label={`Retirer le filtre ${filtre.libelle}`}
            className="rounded-full p-0.5 transition-colors hover:bg-primary-container hover:text-white"
          >
            <X className="h-3 w-3" aria-hidden />
          </button>
        </span>
      ))}
      {actifs.length > 1 && (
        <button
          type="button"
          onClick={() =>
            majParametres(Object.fromEntries(actifs.map((f) => [f.parametre, undefined])))
          }
          className="ml-1 text-body-sm text-text-secondary underline-offset-2 transition-colors hover:text-primary-container hover:underline"
        >
          Tout effacer
        </button>
      )}
    </div>
  );
}

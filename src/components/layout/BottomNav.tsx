'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';
import { MoreHorizontal, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ITEMS_BAS_SIDEBAR, ITEM_SUPPORT, type SidebarItem } from '@/lib/navigation';
import { ICONES } from './Sidebar';
import { RechercheGlobale } from './RechercheGlobale';

/**
 * Barre d'onglets basse, seule navigation sous `md` (la sidebar y est masquée).
 *
 * ## Ancrée, et non plus flottante
 *
 * Elle flottait : pilule translucide à 24px du bas, 48px de marges latérales.
 * Ancrée au bord, elle récupère ces 48px — et c'est cette largeur qui paie les
 * libellés. Un fond opaque se lit mieux qu'un fond translucide posé sur une
 * liste qui défile, pas moins.
 *
 * ## Les libellés ne sont pas un ornement
 *
 * La barre n'avait que des icônes. Or `icones-navigation.ts` a déjà coûté un
 * défaut connu — Rapports, Statistiques et Journal d'audit partageaient la même
 * icône, indistinguables. Quelqu'un qui ouvre l'application deux fois par
 * semaine devine. Les libellés courts existent depuis toujours dans
 * `navigation.ts` (`labelCourt` : « Accueil », « Académique », « École »,
 * « Stats ») et n'étaient lus par personne : ils sont faits pour ici.
 *
 * 12px, le plancher du système, et non 10 ou 11 — le relevé du 2026-09-04 a
 * assez montré ce que coûte un texte sous le plancher. La barre passe de 56 à
 * 64px : huit pixels pour que la navigation se lise.
 *
 * ## Le bouton central est la recherche, et il ne change jamais de sens
 *
 * Le modèle est la barre de Mixx by Yas, dont le centre est un scanner :
 * « la chose devant moi, agis dessus ». Ici c'est « **la personne devant moi,
 * trouve-la** » — un parent se présente au secrétariat, il faut son élève, sa
 * facture, son solde. C'est le premier pas de presque tous les parcours.
 *
 * Deux autres pistes ont été écartées. **L'action principale de la page** :
 * elle n'existe que sur cinq écrans sur une quarantaine (`BoutonFlottant`), et
 * un bouton qui change de sens au même pixel fait taper à côté — on apprend
 * « bas-centre = nouvel élève », et ailleurs le même pouce encaisse. **Le
 * support** : en faire la proposition permanente de l'application, c'est en
 * faire le premier réflexe de qui ne trouve pas.
 *
 * La recherche, elle, a toujours un sens, y compris sur `/dashboard`,
 * `/statistiques` et `/rapports`. Et elle comble un trou réel : `RechercheGlobale`
 * est en `hidden md:block` dans l'en-tête — chercher un élève depuis n'importe
 * où était **impossible sur téléphone**. Ce qui descend dans la page sous `md`
 * est la recherche de la liste courante, qui ne cherche que dans ce qui est
 * déjà affiché.
 *
 * Elle ne dispute rien au `BoutonFlottant`, qui reste au coin bas droit sur ses
 * cinq écrans : trouver au centre, créer au coin, aucune des deux places n'étant
 * ambiguë.
 *
 * ## Une échancrure, pas un rond posé sur un rectangle
 *
 * Le fond de la barre est un calque à part, masqué par un dégradé radial qui
 * creuse un trou de 37px de rayon au milieu de son bord haut. Le bouton fait 28px
 * de rayon : il reste **9px de jour** tout autour, par lesquels on voit la page.
 * C'est ce jour qui fait la différence entre un bouton docké et une pastille
 * collée.
 *
 * Le masque est sur un calque et non sur la `<nav>` : un masque s'applique aussi
 * aux enfants, et il effacerait exactement le bouton qu'il est là pour mettre en
 * valeur.
 *
 * ## Deux teintes du même bleu
 *
 * Mixx tient parce qu'il a deux couleurs de marque, jaune sur marine. Le produit
 * n'en a qu'une, mais la palette porte déjà l'écart : barre en `primary`
 * (#003d9b), disque du bouton en `primary-fixed` (#dae2ff) avec la loupe en
 * `primary-container` (#0052cc), onglet actif en `primary-fixed-dim` (#b2c5ff).
 * Les libellés inactifs sont blancs à 70 %, au-dessus de 4,5:1 sur ce fond.
 *
 * ## La loupe n'a pas de libellé, et c'est délibéré
 *
 * Écrire « Rechercher » sous la loupe coûtait deux fois : la colonne prenait la
 * largeur du mot, et « Académique » se tronquait en « Académ... » juste à côté.
 * Une loupe se lit sans légende ; un onglet dont le nom est coupé, non. Le nom
 * reste en `aria-label`, pour qui ne voit pas l'icône.
 */
const MAX_ONGLETS_DIRECTS = 3;

function estActif(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Contenu d'un onglet : icône puis libellé.
 *
 * Il est rendu **dans** l'élément cliquable, qui occupe toute la hauteur de la
 * barre. Le relevé du 2026-09-04 mesurait 81×36 sur le lien lui-même, répété
 * 141 fois : la navigation principale de toute l'application passait sous la
 * cible de 44px, sur chaque page, parce que le lien prenait la taille de ce
 * qu'il contenait. Ne pas retirer `h-full` en croyant que la barre suffit.
 */
function ContenuOnglet({
  Icone,
  libelle,
  actif,
}: {
  Icone: (typeof ICONES)[keyof typeof ICONES];
  libelle: string;
  actif: boolean;
}) {
  return (
    <>
      <Icone
        className={cn('h-[22px] w-[22px]', actif ? 'text-primary-fixed-dim' : 'text-white/65')}
        strokeWidth={actif ? 2.25 : 1.75}
        aria-hidden
      />
      <span
        className={cn(
          'max-w-full truncate text-[12px] leading-[14px] tracking-tight',
          actif ? 'font-semibold text-primary-fixed-dim' : 'text-white/70',
        )}
      >
        {libelle}
      </span>
    </>
  );
}

const CLASSE_ONGLET =
  'flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-1.5 px-0.5';

/**
 * L'échancrure du fond : un trou de 37px de rayon centré sur le bord haut de la
 * barre, pour un bouton de 28px de rayon — 9px de jour tout autour.
 */
const ECHANCRURE = 'radial-gradient(circle 37px at 50% 0, transparent 98%, #000 100%)';

export function BottomNav({ items, role }: { items: SidebarItem[]; role?: string }) {
  const pathname = usePathname();
  const [plusOuvert, setPlusOuvert] = React.useState(false);
  const [rechercheOuverte, setRechercheOuverte] = React.useState(false);

  const principaux = items.slice(0, MAX_ONGLETS_DIRECTS);
  // « Plus » regroupe les entrées du rôle au-delà des onglets directs, plus les
  // réglages communs.
  // Le support est rattaché ici et non à `ITEMS_BAS_SIDEBAR` : sur desktop il
  // passe par la bulle flottante, qui est masquée sous `md`. Sans cette ligne,
  // il serait injoignable sur téléphone.
  const surplus: SidebarItem[] = [
    ...items.slice(MAX_ONGLETS_DIRECTS),
    ...ITEMS_BAS_SIDEBAR,
    ITEM_SUPPORT,
  ];

  // `rechercheGlobale` est gardée pour les quatre rôles d'école. La console de
  // plateforme n'y a pas accès : plutôt qu'un bouton qui répondrait « interdit »,
  // elle n'a pas de centre et ses onglets se partagent toute la largeur.
  const avecRecherche = role !== undefined && role !== 'SUPER_ADMIN';
  const gauche = avecRecherche ? principaux.slice(0, 2) : principaux;
  const droite = avecRecherche ? principaux.slice(2) : [];

  if (items.length === 0) return null;

  const onglet = (item: SidebarItem) => {
    const Icone = ICONES[item.icone];
    const actif = estActif(pathname, item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={actif ? 'page' : undefined}
        className={CLASSE_ONGLET}
      >
        <ContenuOnglet Icone={Icone} libelle={item.labelCourt ?? item.label} actif={actif} />
      </Link>
    );
  };

  return (
    <>
      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom,0px)] md:hidden"
      >
        <div
          aria-hidden
          className="absolute inset-0 rounded-t-[28px] bg-primary"
          style={
            avecRecherche ? { WebkitMaskImage: ECHANCRURE, maskImage: ECHANCRURE } : undefined
          }
        />

        <div className="relative flex h-16 items-stretch">
          {gauche.map(onglet)}

          {avecRecherche && (
            /* La colonne est étroite et fixe : le bouton n'a pas de libellé, il
               n'a donc pas à prendre la largeur d'un onglet. Ce sont les quatre
               autres qui en profitent, et « Académique » cesse de se tronquer.

               Le bouton fait 56px, soit la cible tactile avec de la marge, et son
               centre est posé sur le bord haut de la barre : la moitié qui dépasse
               est cliquable comme le reste. */
            <div className="relative w-[74px] shrink-0">
              <button
                type="button"
                onClick={() => setRechercheOuverte(true)}
                aria-haspopup="dialog"
                aria-label="Rechercher un élève, une classe, un enseignant"
                className="absolute left-1/2 top-0 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-primary-fixed text-primary-container shadow-[0_6px_16px_-4px_rgba(0,24,72,0.45)] transition-transform active:scale-95"
              >
                <Search className="h-[26px] w-[26px]" strokeWidth={2.5} aria-hidden />
              </button>
            </div>
          )}

          {droite.map(onglet)}

          {surplus.length > 0 && (
            <button
              type="button"
              onClick={() => setPlusOuvert(true)}
              aria-haspopup="dialog"
              className={CLASSE_ONGLET}
            >
              {/* « Plus » ne prend jamais l'état actif : seul l'onglet de la
                  page courante s'allume. */}
              <ContenuOnglet Icone={MoreHorizontal} libelle="Plus" actif={false} />
            </button>
          )}
        </div>
      </nav>

      {avecRecherche && (
        <Dialog open={rechercheOuverte} onOpenChange={setRechercheOuverte}>
          <DialogContent className="md:hidden">
            <DialogHeader>
              <DialogTitle>Rechercher</DialogTitle>
            </DialogHeader>
            <div className="p-5 pt-0">
              {/*
                Le même composant que l'en-tête de bureau, et non une seconde
                recherche : deux implémentations finissent par diverger, et c'est
                déjà arrivé sur la table des icônes de navigation.
              */}
              <RechercheGlobale focusAuMontage enFlux onNaviguer={() => setRechercheOuverte(false)} />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {surplus.length > 0 && (
        <Dialog open={plusOuvert} onOpenChange={setPlusOuvert}>
          <DialogContent className="md:hidden">
            <DialogHeader>
              <DialogTitle>Plus</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3 p-5">
              {surplus.map((item) => {
                const Icone = ICONES[item.icone];
                const actif = estActif(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setPlusOuvert(false)}
                    className={cn(
                      'flex min-h-[--spacing-row-standard] flex-col items-center justify-center gap-2 rounded-xl border p-4 text-center text-body-sm transition-colors',
                      actif
                        ? 'border-primary/30 bg-secondary-container text-primary'
                        : 'border-surface-border text-text-primary active:bg-surface-container',
                    )}
                  >
                    <Icone className="h-5 w-5" aria-hidden />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

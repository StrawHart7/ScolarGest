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
 * ## Deux teintes du même bleu
 *
 * Mixx tient parce qu'il a deux couleurs de marque, jaune sur marine. Le produit
 * n'en a qu'une, mais la palette porte déjà l'écart : barre en `primary`
 * (#003d9b), bouton et onglet actif en `primary-fixed-dim` (#b2c5ff), icône du
 * bouton en `primary-on-fixed`. Le libellé inactif est blanc à 75 %, ce qui
 * reste au-dessus de 4,5:1 sur ce fond.
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
        className={cn('h-[22px] w-[22px]', actif ? 'text-primary-fixed-dim' : 'text-white/75')}
        strokeWidth={actif ? 2.25 : 1.75}
        aria-hidden
      />
      <span
        className={cn(
          'max-w-full truncate text-[12px] leading-[14px]',
          actif ? 'font-semibold text-primary-fixed-dim' : 'text-white/75',
        )}
      >
        {libelle}
      </span>
    </>
  );
}

const CLASSE_ONGLET = 'flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1';

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
        className="fixed inset-x-0 bottom-0 z-40 bg-primary pb-[env(safe-area-inset-bottom,0px)] md:hidden"
      >
        <div className="flex h-16 items-stretch">
          {gauche.map(onglet)}

          {avecRecherche && (
            <div className="relative min-w-0 flex-1">
              {/*
                La boîte cliquable remonte de 28px (`-top-7`) pour englober la
                part du bouton qui dépasse de la barre : sans cela, la moitié
                haute du rond — la plus visible — ne répondrait pas au doigt.
              */}
              <button
                type="button"
                onClick={() => setRechercheOuverte(true)}
                aria-haspopup="dialog"
                aria-label="Rechercher un élève, une classe, un enseignant"
                className="absolute inset-x-0 -top-7 bottom-0 flex flex-col items-center justify-end pb-3"
              >
                <span className="absolute left-1/2 top-0 grid h-14 w-14 -translate-x-1/2 place-items-center rounded-full border-4 border-primary bg-primary-fixed-dim text-primary-on-fixed shadow-floating transition-transform active:scale-95">
                  <Search className="h-6 w-6" strokeWidth={2.25} aria-hidden />
                </span>
                <span className="text-[12px] leading-[14px] text-white/75">Rechercher</span>
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

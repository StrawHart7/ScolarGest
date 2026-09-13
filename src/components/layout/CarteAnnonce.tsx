'use client';

import * as React from 'react';
import { ChevronRight, GraduationCap, Megaphone, Wrench, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TypeAnnonce } from '@/lib/annonce';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useSidebarCollapse } from './sidebar-collapse';

/**
 * L'annonce de la plateforme, telle qu'elle se montre à l'école.
 *
 * ## Pourquoi elle vit dans la barre latérale
 *
 * Le premier jet la posait en bandeau au-dessus du contenu, à la suite de
 * `AbonnementBanner`. C'est la place des messages qu'on subit une fois : on les
 * lit, on descend, et la page suivante les efface de l'attention même
 * lorsqu'ils sont toujours là. Une annonce de plateforme n'a pas ce rythme —
 * « les épreuves du BAC commencent lundi » doit rester sous les yeux pendant
 * les quatre jours qui précèdent, sans jamais se mettre en travers du travail.
 *
 * La barre latérale est exactement cet endroit : toujours visible, jamais dans
 * le chemin. Décision de l'utilisateur le 2026-09-13 ; elle déplace l'objet,
 * elle ne change rien à ce que la Régie décide.
 *
 * **Sous `md` il n'y a pas de barre latérale.** La variante `bandeau` reste
 * donc le seul rendu du téléphone, et c'est elle qui porte `data-bandeau` —
 * voir `BandeauAnnonce` pour ce repère.
 *
 * ## Encre, et non une carte de plus
 *
 * La barre latérale est claire, et tout ce qu'elle contient l'est aussi. Une
 * carte claire de plus s'y serait fondue — règle déjà payée sur le panneau de
 * conseil : « un panneau qui doit être lu ne peut pas ressembler à la page ».
 * D'où le fond encre, seul objet sombre de l'écran.
 *
 * Le conseil, lui, est bleu. Les deux ne se confondent donc pas, et la
 * distinction est juste : le conseil propose quelque chose à faire, l'annonce
 * informe de quelque chose qui arrive.
 *
 * Une seule forme pour les trois types, l'accent seul les sépare. Trois fonds
 * différents auraient fait trois objets là où il n'y en a qu'un : la plateforme
 * qui parle.
 *
 * ## Le texte peut faire 500 caractères
 *
 * La borne est en base, pas dans l'usage : un opérateur pressé écrira un pavé
 * un jour, et le titre seul peut en faire 120. Dans une colonne de 208px
 * utiles, 500 caractères font une vingtaine de lignes — la carte mangerait la
 * navigation entière.
 *
 * Le texte est donc tronqué, et « Lire » ouvre le message entier. Le bouton
 * n'apparaît **que si la troncature a réellement eu lieu** : proposer d'ouvrir
 * un message déjà entièrement lisible apprend à ignorer le bouton.
 *
 * ## La deuxième annonce est une rangée, pas une seconde carte
 *
 * Mesuré sur la maquette compilée avec les tokens du produit, deux cartes
 * pleines font **349px dans une barre latérale de 760px** — la moitié de la
 * colonne, navigation comprise — et **397px avant le contenu sur un écran de
 * 844px, soit 47 %** une fois ajoutés l'en-tête et le bandeau d'abonnement. La
 * page commençait sous la ligne de flottaison, exactement le cas que SOKO
 * demandait de regarder en premier.
 *
 * Deux cartes de même poids ne se lisent d'ailleurs pas deux fois : elles se
 * concurrencent, et aucune n'est lue. La première garde sa carte, la suivante
 * devient une rangée d'une ligne qui ouvre le même lecteur. Rien n'est perdu —
 * un geste sépare le titre du message entier — et l'ensemble retombe à 215px
 * dans la barre et 261px sur téléphone.
 */

export interface AnnonceAffichee {
  id: string;
  type: TypeAnnonce;
  titre: string;
  message: string;
  /** Déjà formaté côté serveur — voir `annonces-du-rendu.ts`. */
  finitLeLabel: string;
}

interface Presentation {
  libelle: string;
  /** Couleur de l'icône et de l'étiquette, sur fond encre. */
  accent: string;
  /** La même famille, lisible sur fond clair : en-tête du lecteur. */
  accentClair: string;
  icone: LucideIcon;
}

const PRESENTATION: Record<TypeAnnonce, Presentation> = {
  // Une session d'examen est une échéance institutionnelle, pas une alerte :
  // le bleu du produit, pas une couleur d'alarme.
  EXAMEN_NATIONAL: {
    libelle: 'Examen national',
    accent: 'text-primary-fixed-dim',
    accentClair: 'text-primary-container',
    icone: GraduationCap,
  },
  // Une information ordinaire n'a pas de couleur : lui en donner une la ferait
  // passer pour urgente à chaque fois.
  ANNONCE: {
    libelle: 'Information',
    accent: 'text-inverse-on-surface/65',
    accentClair: 'text-text-secondary',
    icone: Megaphone,
  },
  // `warning` et non `error` : une interruption annoncée n'est la faute de
  // personne. Voir « une couleur d'alarme ne dit pas un état subi ».
  MAINTENANCE: {
    libelle: 'Maintenance',
    accent: 'text-warning',
    accentClair: 'text-warning-on-container',
    icone: Wrench,
  },
};

function presentationDe(type: TypeAnnonce): Presentation {
  return PRESENTATION[type] ?? PRESENTATION.ANNONCE;
}

/**
 * Le contenu de l'élément déborde-t-il de sa troncature ?
 *
 * `line-clamp` fige `clientHeight` ; c'est `scrollHeight` qui varie. Un
 * `ResizeObserver` seul ne suffit donc pas — la boîte ne change pas de taille
 * quand la police de substitution cède la place à Inter, alors que le nombre de
 * lignes réellement occupées, lui, change. D'où la seconde mesure après
 * `document.fonts.ready` : sans elle, la carte déciderait d'afficher le bouton
 * d'après une police qui n'est pas celle du rendu final.
 */
function useDeborde<T extends HTMLElement>() {
  const ref = React.useRef<T>(null);
  const [deborde, setDeborde] = React.useState(false);

  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const mesurer = () => setDeborde(element.scrollHeight > element.clientHeight + 1);
    mesurer();

    const observateur = new ResizeObserver(mesurer);
    observateur.observe(element);
    // `document.fonts` manque sur les navigateurs anciens : jamais supposé.
    document.fonts?.ready.then(mesurer).catch(() => {});

    return () => observateur.disconnect();
  }, []);

  return { ref, deborde };
}

function Carte({
  annonce,
  variante,
  onLire,
}: {
  annonce: AnnonceAffichee;
  variante: 'sidebar' | 'bandeau';
  onLire: () => void;
}) {
  const presentation = presentationDe(annonce.type);
  const Icone = presentation.icone;
  const titre = useDeborde<HTMLParagraphElement>();
  const message = useDeborde<HTMLParagraphElement>();
  const tronque = titre.deborde || message.deborde;

  const fond = cn(
    'relative block w-full overflow-hidden text-left bg-inverse-surface text-inverse-on-surface',
    variante === 'sidebar' ? 'rounded-xl px-3.5 py-3 shadow-subtle' : 'px-gutter py-3',
  );

  const contenu = (
    <>
      {/* Un aplat d'encre nu paraît plat à cette taille. Un seul dégradé de
          blanc très faible lui donne une source de lumière, sans introduire de
          couleur hors palette. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.08] via-transparent to-transparent"
      />

      <div className="relative">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'grid h-6 w-6 shrink-0 place-items-center rounded-md bg-white/10',
              presentation.accent,
            )}
          >
            <Icone className="h-3.5 w-3.5" aria-hidden />
          </span>
          <span className={cn('truncate text-console-eyebrow uppercase', presentation.accent)}>
            {presentation.libelle}
          </span>
          {/* La date de fin dit que l'annonce s'éteindra d'elle-même. Sans
              elle, un message qu'on ne peut pas fermer ressemble à une
              installation permanente. Sur la carte étroite elle descend en
              pied, faute de place sur la ligne d'étiquette. */}
          {variante === 'bandeau' && (
            <>
              <span className="ml-auto min-w-0 truncate text-touch-meta text-inverse-on-surface/55">
                {annonce.finitLeLabel}
              </span>
              {tronque && (
                <ChevronRight
                  className="h-4 w-4 shrink-0 text-inverse-on-surface/55"
                  aria-hidden
                />
              )}
            </>
          )}
        </div>

        <p ref={titre.ref} className="mt-2.5 line-clamp-2 text-body-sm font-semibold leading-snug">
          {annonce.titre}
        </p>
        <p
          ref={message.ref}
          className={cn(
            'mt-1 text-touch-meta leading-[1.45] text-inverse-on-surface/70',
            // Deux lignes dans la barre latérale, où la carte reste posée toute
            // la journée ; une seule sur téléphone, où chaque ligne repousse le
            // début de la page d'autant.
            variante === 'sidebar' ? 'line-clamp-2' : 'line-clamp-1',
          )}
        >
          {annonce.message}
        </p>

        {variante === 'sidebar' && (
          <div className="mt-2.5 flex items-center gap-3">
            <span className="min-w-0 truncate text-touch-meta text-inverse-on-surface/55">
              {annonce.finitLeLabel}
            </span>
            {tronque && (
              <span className="ml-auto h-7 shrink-0 rounded-md bg-white/10 px-3 text-console-eyebrow uppercase leading-7 text-inverse-on-surface transition-colors group-hover:bg-white/20">
                Lire
              </span>
            )}
          </div>
        )}
      </div>
    </>
  );

  // Rien de plus à lire : la carte n'est pas cliquable. Un bouton qui rouvre
  // ce qui est déjà entièrement à l'écran apprend à ignorer le bouton.
  if (!tronque) return <article className={fond}>{contenu}</article>;

  // La cible est la carte entière, pas un mot dans un coin. Sur téléphone
  // c'est la seule manière d'atteindre le plancher de 44px sans ajouter une
  // rangée d'action — mesurée à 54px, soit un tiers de la hauteur du bandeau.
  // Sur la barre latérale, la même surface évite de viser une pastille de 28px
  // à la souris. « Lire » reste écrit : c'est l'affordance, la cible est
  // dessous.
  return (
    <button
      type="button"
      onClick={onLire}
      aria-label={`${presentation.libelle} : ${annonce.titre}. Lire l'annonce entière.`}
      className={cn(
        fond,
        'group transition-colors hover:bg-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container/50',
      )}
    >
      {contenu}
    </button>
  );
}

/**
 * Les annonces au-delà de la première : une rangée, jamais une seconde carte.
 *
 * Voir l'en-tête du module pour les mesures. En un mot : deux cartes de même
 * poids ne se lisent pas deux fois, elles se concurrencent — et sur téléphone
 * elles repoussaient le début de la page sous la ligne de flottaison.
 */
function Rangee({
  annonce,
  variante,
  onLire,
}: {
  annonce: AnnonceAffichee;
  variante: 'sidebar' | 'bandeau';
  onLire: () => void;
}) {
  const presentation = presentationDe(annonce.type);
  const Icone = presentation.icone;

  return (
    <button
      type="button"
      onClick={onLire}
      aria-label={`${presentation.libelle} : ${annonce.titre}. Lire l'annonce entière.`}
      className={cn(
        'flex w-full items-center gap-2 bg-inverse-surface text-left text-inverse-on-surface transition-colors hover:bg-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container/50',
        variante === 'sidebar'
          ? 'h-row-standard rounded-xl px-3.5 shadow-subtle'
          : 'h-row-standard px-gutter',
      )}
    >
      <Icone className={cn('h-3.5 w-3.5 shrink-0', presentation.accent)} aria-hidden />
      <span className="min-w-0 flex-1 truncate text-touch-meta">{annonce.titre}</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-inverse-on-surface/55" aria-hidden />
    </button>
  );
}

export function CarteAnnonce({
  annonces,
  variante,
}: {
  annonces: AnnonceAffichee[];
  variante: 'sidebar' | 'bandeau';
}) {
  // Lu sans condition : le composant vit toujours sous le fournisseur, qu'il
  // rende la carte ou le bandeau.
  const { replie } = useSidebarCollapse();
  const [ouverte, setOuverte] = React.useState<AnnonceAffichee | null>(null);

  // Déstructuré et non indexé : `noUncheckedIndexedAccess` est actif, et il a
  // raison — c'est la garde de liste vide qui manquait.
  const [premiere, ...suivantes] = annonces;
  if (!premiere) return null;

  const lecteur = (
    <Dialog open={ouverte !== null} onOpenChange={(ouvert) => !ouvert && setOuverte(null)}>
      <DialogContent taille="md">
        {ouverte && (
          <>
            <DialogHeader>
              <p
                className={cn(
                  'text-console-eyebrow uppercase',
                  presentationDe(ouverte.type).accentClair,
                )}
              >
                {presentationDe(ouverte.type).libelle}
              </p>
              <DialogTitle>{ouverte.titre}</DialogTitle>
            </DialogHeader>
            <DialogBody>
              {/* `whitespace-pre-line` : la Régie saisit dans un champ
                  multiligne, et écraser ses retours à la ligne transformerait
                  une liste de centres d'examen en un seul pavé. */}
              <p className="whitespace-pre-line text-body-md text-text-primary">
                {ouverte.message}
              </p>
              <p className="text-body-sm text-text-secondary">{ouverte.finitLeLabel}</p>
            </DialogBody>
          </>
        )}
      </DialogContent>
    </Dialog>
  );

  // Rail replié : 72px de large, aucune place pour du texte. L'annonce ne
  // disparaît pas pour autant — elle se réduit à sa pastille, qui ouvre le
  // message entier. Un repli d'interface décidé par l'utilisateur ne doit pas
  // lui faire perdre une information que la plateforme a décidé d'envoyer.
  if (variante === 'sidebar' && replie) {
    return (
      <div className="flex flex-col items-center gap-2 px-2 pb-3">
        {annonces.map((annonce) => {
          const presentation = presentationDe(annonce.type);
          const Icone = presentation.icone;
          return (
            <button
              key={annonce.id}
              type="button"
              onClick={() => setOuverte(annonce)}
              title={annonce.titre}
              aria-label={`${presentation.libelle} : ${annonce.titre}`}
              className="grid h-10 w-10 place-items-center rounded-lg bg-inverse-surface transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container/40"
            >
              <Icone className={cn('h-[18px] w-[18px]', presentation.accent)} aria-hidden />
            </button>
          );
        })}
        {lecteur}
      </div>
    );
  }

  return (
    <section
      // Nommée : sans étiquette, un lecteur d'écran annonce « région » au
      // milieu de la navigation, sans dire de quoi il s'agit. Le bandeau, lui,
      // porte déjà `role="status"` sur son conteneur — voir `BandeauAnnonce`.
      aria-label={annonces.length > 1 ? 'Annonces de la plateforme' : 'Annonce de la plateforme'}
      className={
        variante === 'sidebar'
          ? 'space-y-2 px-3 pb-3'
          : 'divide-y divide-white/10 border-b border-surface-border'
      }
    >
      <Carte annonce={premiere} variante={variante} onLire={() => setOuverte(premiere)} />
      {suivantes.map((annonce) => (
        <Rangee
          key={annonce.id}
          annonce={annonce}
          variante={variante}
          onLire={() => setOuverte(annonce)}
        />
      ))}
      {lecteur}
    </section>
  );
}

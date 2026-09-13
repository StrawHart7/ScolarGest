'use client';

import * as React from 'react';
import { ChevronRight, GraduationCap, Megaphone, Wrench, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TypeAnnonce } from '@/lib/annonce';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { marquerAnnonceLueAction } from '@/app/annonce-actions';
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
 * ## Toute annonce s'ouvre, toujours
 *
 * Le texte est tronqué : le titre peut faire 120 caractères et le message 500,
 * bornes tenues en base, et 500 caractères font une vingtaine de lignes dans
 * une colonne de 208px utiles. La carte mangerait la navigation entière.
 *
 * La première version ne rendait la carte cliquable **que si la troncature
 * avait réellement eu lieu**, mesurée au pixel après le chargement des
 * polices. L'intention était bonne — ne pas proposer d'ouvrir ce qui est déjà
 * lisible — et le résultat était un défaut franc : sur une annonce longue
 * seule, le bouton n'apparaissait pas et l'école ne pouvait pas lire la suite
 * d'un message manifestement coupé. Constaté par l'utilisateur en preview le
 * 2026-09-13.
 *
 * La leçon est plus large que le bug : **une surface qui n'est cliquable que
 * dans certaines conditions ne s'apprend pas.** L'utilisateur ne peut pas
 * savoir si le clic ne fait rien parce qu'il n'y a rien de plus, ou parce que
 * l'application est cassée. Mieux vaut ouvrir un message déjà entièrement lu
 * que d'en rendre un inaccessible. La mesure de troncature est donc retirée,
 * et avec elle toute une classe de pannes silencieuses.
 *
 * ## Le style est celui du panneau de conseil
 *
 * Même dégradé, même texte blanc, même pastille d'icône en `bg-white/15`, même
 * pied séparé par un filet `border-white/15`, et la même action inversée en
 * blanc sur le fond coloré — le bouton primaire du système est bleu, il
 * disparaîtrait ici. C'est la voix « la plateforme s'adresse à vous » que le
 * produit a déjà, et lui en donner une seconde en aurait fait deux objets
 * différents pour une seule intention.
 *
 * Le conseil propose quelque chose à faire, l'annonce informe de quelque chose
 * qui arrive : la distinction se lit dans l'icône et l'étiquette, pas dans un
 * habillage séparé.
 *
 * ## La deuxième annonce est une rangée, pas une seconde carte
 *
 * Mesuré sur maquette compilée avec les tokens du produit, deux cartes pleines
 * faisaient **349px dans une barre latérale de 760px** et **397px avant le
 * contenu sur un écran de 844px, soit 47 %**. La page commençait sous la ligne
 * de flottaison — le cas que SOKO demandait de regarder en premier.
 *
 * Deux cartes de même poids ne se lisent d'ailleurs pas deux fois : elles se
 * concurrencent, et aucune n'est lue. La première garde sa carte, la suivante
 * devient une rangée d'une ligne qui ouvre le même lecteur.
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
  /** Le fond de la carte. Blanc dessus, dans tous les cas. */
  fond: string;
  /** Couleur du texte de l'action inversée, posée sur blanc. */
  actionTexte: string;
  /** L'étiquette du lecteur, sur fond clair cette fois. */
  accentClair: string;
  icone: LucideIcon;
}

const PRESENTATION: Record<TypeAnnonce, Presentation> = {
  // Une session d'examen est une échéance institutionnelle, pas une alerte :
  // le bleu du produit, celui du conseil.
  EXAMEN_NATIONAL: {
    libelle: 'Examen national',
    fond: 'bg-gradient-to-br from-primary to-primary-container',
    actionTexte: 'text-primary',
    accentClair: 'text-primary-container',
    icone: GraduationCap,
  },
  ANNONCE: {
    libelle: 'Information',
    fond: 'bg-gradient-to-br from-primary to-primary-container',
    actionTexte: 'text-primary',
    accentClair: 'text-text-secondary',
    icone: Megaphone,
  },
  // `warning` et non `error` : une interruption annoncée n'est la faute de
  // personne, et le rouge inquiéterait sans rien proposer. Le fond ambré foncé
  // porte le blanc à 6:1 — l'ambre clair, lui, ne le porterait pas.
  MAINTENANCE: {
    libelle: 'Maintenance',
    fond: 'bg-warning-on-container',
    actionTexte: 'text-warning-on-container',
    accentClair: 'text-warning-on-container',
    icone: Wrench,
  },
};

function presentationDe(type: TypeAnnonce): Presentation {
  return PRESENTATION[type] ?? PRESENTATION.ANNONCE;
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

  return (
    <button
      type="button"
      onClick={onLire}
      aria-label={`${presentation.libelle} : ${annonce.titre}. Ouvrir l'annonce.`}
      className={cn(
        'group block w-full overflow-hidden rounded-xl text-left shadow-premium transition-shadow hover:shadow-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container/50 focus-visible:ring-offset-2',
        presentation.fond,
      )}
    >
      <div className="p-3.5">
        <div className="flex items-center gap-2">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white/15 text-white">
            <Icone className="size-3.5" aria-hidden />
          </span>
          {/* Casse normale, pas un cartouche en capitales : à 260px, des
              capitales espacées coûtent un cinquième de largeur en plus pour la
              même information. C'est la leçon du tableau de bord, relevée le
              2026-09-13 — une étiquette n'est pas un en-tête de colonne. */}
          <span className="min-w-0 truncate text-label-md text-white/75">
            {presentation.libelle}
          </span>
        </div>

        <p className="mt-2 line-clamp-2 text-body-md font-medium text-white">{annonce.titre}</p>
        <p
          className={cn(
            'mt-1 text-body-sm text-white/80',
            // Deux lignes dans la barre latérale, où la carte est posée dans une
            // colonne qui ne sert qu'à ça. Une seule sur téléphone, où chaque
            // ligne repousse le début de la page d'autant : mesuré, le bloc
            // complet passe de 43 % à 38 % de l'écran.
            variante === 'sidebar' ? 'line-clamp-2' : 'line-clamp-1',
          )}
        >
          {annonce.message}
        </p>
      </div>

      <div
        className={cn(
          'flex items-center gap-2 border-t border-white/15 px-3.5',
          variante === 'sidebar' ? 'py-2.5' : 'py-2',
        )}
      >
        {/* La date de fin dit que l'annonce s'éteindra d'elle-même. Sans elle,
            un message qu'on ne peut pas fermer ressemble à une installation
            permanente. */}
        {/* `touch-meta` (12px) et non `body-sm` : à 260px, la ligne partage sa
            place avec la pastille « Lire », et « Se termine aujourd'hui » en
            13px se faisait couper au milieu du mot. C'est une méta-donnée, elle
            a le droit d'être au plancher de l'échelle. */}
        <span className="min-w-0 truncate text-touch-meta text-white/70">
          {annonce.finitLeLabel}
        </span>
        {/* La carte entière est la cible ; ceci est l'affordance, donc un
            `span` et non un bouton — un bouton dans un bouton est du HTML
            invalide, et le second ne serait pas atteignable au clavier. */}
        <span
          className={cn(
            'ml-auto inline-flex shrink-0 items-center gap-0.5 rounded-lg bg-white pl-3 pr-2 text-body-sm font-medium transition-colors group-hover:bg-primary-fixed',
            presentation.actionTexte,
            // Le bandeau est le rendu du téléphone : la carte entière fait déjà
            // largement plus que le plancher de 44px, mais la pastille doit
            // rester confortable à l'œil, pas seulement au doigt.
            variante === 'sidebar' ? 'h-8' : 'h-9',
          )}
        >
          Lire
          <ChevronRight className="size-4" aria-hidden />
        </span>
      </div>
    </button>
  );
}

/**
 * Les annonces au-delà de la première : une rangée, jamais une seconde carte.
 * Voir l'en-tête du module pour les mesures.
 */
function Rangee({ annonce, onLire }: { annonce: AnnonceAffichee; onLire: () => void }) {
  const presentation = presentationDe(annonce.type);
  const Icone = presentation.icone;

  return (
    <button
      type="button"
      onClick={onLire}
      aria-label={`${presentation.libelle} : ${annonce.titre}. Ouvrir l'annonce.`}
      className={cn(
        'flex h-row-standard w-full items-center gap-2.5 rounded-xl px-3.5 text-left text-white shadow-floating transition-shadow hover:shadow-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container/50 focus-visible:ring-offset-2',
        presentation.fond,
      )}
    >
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white/15">
        <Icone className="size-3.5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 truncate text-body-sm">{annonce.titre}</span>
      <ChevronRight className="size-4 shrink-0 text-white/70" aria-hidden />
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
  const [enCours, demarrerTransition] = React.useTransition();

  /**
   * « Marquer comme lu » : on écarte pour soi, pas pour l'école.
   *
   * Le lecteur reste ouvert pendant l'écriture, bouton en attente. Le fermer
   * tout de suite laisserait la carte encore à l'écran une fraction de seconde
   * — le temps de la revalidation du layout — et ce clignotement se lit comme
   * un geste qui n'a pas pris. La transition couvre l'action **et** sa
   * revalidation : quand elle rend la main, la carte a déjà disparu derrière
   * le lecteur, et les deux s'effacent ensemble.
   *
   * `marquerAnnonceLueAction` ne lève jamais et ne rend rien : si l'écriture
   * échoue, l'annonce est simplement toujours là au rendu suivant. Il n'y a
   * donc pas de message d'erreur à prévoir ici — c'est délibéré côté service,
   * et le repli est visible.
   */
  function marquerLue(annonce: AnnonceAffichee) {
    demarrerTransition(async () => {
      await marquerAnnonceLueAction(annonce.id);
      setOuverte(null);
    });
  }

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
                  'text-label-md',
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

            {/*
              Le geste d'écarter vit ici, et nulle part ailleurs.

              La carte de la barre latérale ne se ferme toujours pas : c'est ce
              qui donne à une annonce sa durée. Ce qui change, c'est qu'il faut
              avoir **ouvert** pour pouvoir écarter — refuser ce geste à
              quelqu'un qui vient de tout lire transforme l'information en
              décor, et on apprend vite à sauter le décor.

              En pied de modale, en `ghost`, après le message : on ne le
              rencontre qu'une fois arrivé au bout. « Discret » veut dire ça —
              pas petit, pas caché, simplement pas ce qu'on voit en premier.

              « Marquer comme lu » et non « Ne plus afficher » : le second est
              ambigu sur sa portée — cette annonce, ou toutes ? Le premier
              énonce un fait que la personne peut assumer, et c'est exactement
              ce que la ligne écrite en base contient. La conséquence, elle,
              est dite par la phrase à gauche, qui règle la seule question que
              ce bouton pose vraiment : est-ce que j'écarte pour mes collègues
              aussi ?
            */}
            {/* `justify-end` du pied est conservé, et la phrase est poussée à
                gauche par `mr-auto` plutôt que par `justify-between` : sur un
                téléphone, la phrase et le bouton ne tiennent pas sur la même
                ligne, et `justify-between` renvoyait alors le bouton à gauche
                de la seconde ligne, décalé de tout le reste de la modale. */}
            <DialogFooter className="gap-x-4">
              {/* Mesuré : « Elle disparaîtra de votre écran, pas de celui de
                  vos collègues » demande 376px, et faisait passer le bouton à
                  la ligne jusque sur un écran de bureau — un pied de modale à
                  83px de haut pour une action qui doit rester discrète. La
                  version courte tient sur une ligne à 512px et dit la même
                  chose : « seulement » porte la portée à lui seul. */}
              <p className="mr-auto min-w-0 text-body-sm text-text-secondary">
                Elle disparaîtra pour vous seulement.
              </p>
              <Button
                size="sm"
                variant="ghost"
                chargement={enCours}
                onClick={() => marquerLue(ouverte)}
              >
                Marquer comme lu
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );

  // Rail replié : 72px de large, aucune place pour du texte. L'annonce ne
  // disparaît pas pour autant — elle se réduit à sa pastille, qui ouvre le même
  // lecteur. Un repli d'interface décidé par l'utilisateur ne doit pas lui
  // faire perdre une information que la plateforme a décidé d'envoyer.
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
              aria-label={`${presentation.libelle} : ${annonce.titre}. Ouvrir l'annonce.`}
              className={cn(
                'grid size-10 place-items-center rounded-lg text-white shadow-floating transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container/50',
                presentation.fond,
              )}
            >
              <Icone className="size-[18px]" aria-hidden />
            </button>
          );
        })}
        {lecteur}
      </div>
    );
  }

  return (
    <section
      // Nommée : sans étiquette, un lecteur d'écran annonce « région » au milieu
      // de la navigation, sans dire de quoi il s'agit. Le bandeau, lui, porte
      // déjà `role="status"` sur son conteneur — voir `BandeauAnnonce`.
      aria-label={annonces.length > 1 ? 'Annonces de la plateforme' : 'Annonce de la plateforme'}
      // Le bandeau reprend la mise en place de la bannière de conseil mobile :
      // une carte détachée dans la gouttière, pas un aplat pleine largeur. Un
      // dégradé bord à bord sous l'en-tête pèserait comme une alerte système.
      className={variante === 'sidebar' ? 'space-y-2 px-3 pb-3' : 'space-y-2 px-gutter py-2'}
    >
      <Carte annonce={premiere} variante={variante} onLire={() => setOuverte(premiere)} />
      {suivantes.map((annonce) => (
        <Rangee key={annonce.id} annonce={annonce} onLire={() => setOuverte(annonce)} />
      ))}
      {lecteur}
    </section>
  );
}

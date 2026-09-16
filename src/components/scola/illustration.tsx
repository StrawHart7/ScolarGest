'use client';

import { Scola, type EtatScola } from './index';

/**
 * Scola posé comme illustration : il regarde, il ne se clique pas.
 *
 * ## Pourquoi ce calque
 *
 * Dans le moteur, un seul drapeau — `interactive` — commande deux choses très
 * différentes : **le regard qui suit le curseur**, et le fait que la mascotte
 * devienne un bouton (`role="button"`, arrêt de tabulation, réaction au clic).
 *
 * Or c'est le regard qui la rend vivante, et c'est le bouton qui pose problème
 * partout où on veut la mettre. Sur un écran vide, il ajoute un arrêt de
 * tabulation avant l'action réelle. Dans la bulle de support, il imbrique un
 * bouton dans un lien, ce qui n'a pas de sens et que les lecteurs d'écran
 * annoncent deux fois.
 *
 * On garde donc `interactive`, et on neutralise l'habillage par-dessus : le
 * composant étale ses props **après** ses attributs internes, ce qui permet de
 * les écraser — y compris les gestionnaires, remis à `undefined`.
 *
 * ## Elle est décorative, et le dit
 *
 * `aria-hidden`. Le texte à côté porte déjà le message, en entier : une
 * mascotte qui s'annonce « Scola, la mascotte de ScolarGest » avant chaque état
 * vide ferait perdre du temps à qui écoute la page au lieu de la lire.
 *
 * Là où elle devient l'unique contenu d'une commande — un bouton qui n'aurait
 * qu'elle — il faut au contraire un libellé sur **la commande**, pas sur elle.
 */
export function ScolaIllustration({
  etat = 'idle',
  taille = 88,
}: {
  etat?: EtatScola;
  /** Côté du carré, en pixels. */
  taille?: number;
}) {
  return (
    <Scola
      state={etat}
      size={taille}
      interactive
      role="img"
      aria-hidden
      tabIndex={-1}
      onClick={undefined}
      onKeyDown={undefined}
    />
  );
}

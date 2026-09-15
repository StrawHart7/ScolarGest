/**
 * La phrase qui explique l'écran, sur téléphone.
 *
 * `PageHeader` est enveloppé dans un `hidden md:block` sur presque toutes les
 * listes : il porte un titre, une description et une rangée d'actions, et cette
 * hauteur-là ne tient pas au-dessus d'une liste sur un écran de 390px.
 *
 * La conséquence n'avait pas été mesurée : **la description n'existe pas sur
 * téléphone**. Tout le travail de vocabulaire du 2026-09-15 — dire ce que
 * l'écran permet de faire plutôt que ce à quoi la table sert — était invisible
 * sur le support que les écoles togolaises utilisent le plus.
 *
 * Ce composant ne réintroduit pas l'en-tête : il n'en garde que la phrase. Le
 * titre est déjà porté par l'en-tête de liste juste en dessous, et les actions
 * par la barre d'outils. Deux lignes au maximum — au-delà, ce n'est plus une
 * explication, c'est un paragraphe, et il faut réécrire la phrase plutôt que
 * lui donner plus de place.
 */
export function SousTitreMobile({ children }: { children: React.ReactNode }) {
  return (
    <p className="line-clamp-2 text-body-sm text-text-secondary md:hidden">{children}</p>
  );
}

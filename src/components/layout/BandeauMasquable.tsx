'use client';

import * as React from 'react';
import { X } from 'lucide-react';
// Dans `lib/` et non ici : `AbonnementBanner` est un composant **serveur** et
// les importe. Un module `'use client'` n'expose au serveur que des références
// client — appeler `jourCourant()` y levait, et toutes les pages tombaient.
import { COOKIE_BANDEAU_ABONNEMENT, jourCourant } from '@/lib/bandeau-abonnement';

/**
 * Enveloppe qui permet de fermer un bandeau pour la journée.
 *
 * Le bandeau d'essai s'affichait sur **chaque page**, à chaque navigation, avec
 * son décompte. Vu du directeur, ce n'est pas une information, c'est une
 * relance : l'école se sent poussée à payer alors qu'elle est en train
 * d'essayer le produit — exactement l'inverse de ce qu'un essai doit produire.
 *
 * Le rythme retenu est celui des conseils : une fois par jour au plus, et une
 * décision de l'utilisateur qu'on respecte.
 *
 * ## Pourquoi un cookie et pas `localStorage`
 *
 * Le bandeau est rendu par le **serveur**. Avec `localStorage`, il serait
 * envoyé puis effacé côté client : l'utilisateur le verrait apparaître et
 * disparaître à chaque page. Le cookie est lu avant le rendu, donc le bandeau
 * n'est tout simplement pas produit.
 *
 * La valeur est la **date du jour**, pas un booléen : le lendemain, elle ne
 * correspond plus et le bandeau revient de lui-même. Aucune expiration à
 * calculer, aucun nettoyage.
 */
export function BandeauMasquable({
  children,
  masquable,
}: {
  children: React.ReactNode;
  /**
   * Faux quand l'accès est bloqué ou en lecture seule.
   *
   * **Un bandeau qui explique pourquoi les boutons ne répondent plus ne se
   * ferme pas.** Le masquer laisserait l'utilisateur devant une application
   * inerte sans le moindre motif — et c'est précisément le message qu'il lui
   * faut.
   */
  masquable: boolean;
}) {
  const [masque, setMasque] = React.useState(false);

  if (masque) return null;

  return (
    <div className="relative">
      {children}
      {masquable && (
        <button
          type="button"
          onClick={() => {
            // `SameSite=Lax` et pas de `Secure` en clair : le cookie ne porte
            // qu'une date d'affichage, et l'attribut `Secure` empêcherait le
            // développement en HTTP local sans rien protéger ici.
            document.cookie = `${COOKIE_BANDEAU_ABONNEMENT}=${jourCourant()}; path=/; max-age=86400; samesite=lax`;
            setMasque(true);
          }}
          aria-label="Masquer ce message pour aujourd’hui"
          title="Masquer pour aujourd’hui"
          className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-text-secondary transition-colors hover:bg-surface-container hover:text-text-primary"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      )}
    </div>
  );
}

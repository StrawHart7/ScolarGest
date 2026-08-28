'use client';

import { effacerTousBrouillons } from '@/lib/offline/notes-brouillon-db';
import { SubmitButton } from '@/components/ui/button';
import { seDeconnecterAction } from './actions';

/**
 * Enveloppe cliente autour de `seDeconnecterAction` (Server Action) : une
 * Server Action n'a pas accès à IndexedDB, donc le nettoyage des brouillons
 * de notes locaux doit se faire ici, côté client, avant que le formulaire ne
 * poursuive vers la déconnexion serveur. Sur un poste partagé (plusieurs
 * enseignants sur le même navigateur), ça évite qu'un brouillon non soumis
 * du compte qui se déconnecte soit restauré sous un autre compte ensuite.
 */
export function DeconnexionButton() {
  return (
    <form
      action={seDeconnecterAction}
      onSubmit={() => {
        void effacerTousBrouillons();
      }}
    >
      <SubmitButton variant="secondary" size="sm" libelleEnCours="Déconnexion…">
        Déconnexion
      </SubmitButton>
    </form>
  );
}

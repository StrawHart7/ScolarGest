'use client';

import * as React from 'react';
import { effacerTousBrouillons } from '@/lib/offline/notes-brouillon-db';
import { compterFileTotale } from '@/lib/offline/file-attente';
import { SubmitButton } from '@/components/ui/button';
import { seDeconnecterAction } from './actions';

/**
 * Enveloppe cliente autour de `seDeconnecterAction` (Server Action) : une
 * Server Action n'a pas accès à IndexedDB, donc le nettoyage local doit se
 * faire ici, côté client, avant que le formulaire ne poursuive vers la
 * déconnexion serveur. Sur un poste partagé, ça évite qu'un brouillon, un
 * cache de consultation ou une écriture en attente d'un compte soit repris
 * sous un autre ensuite.
 *
 * **La déconnexion efface aussi la file d'écritures**, ce qui peut détruire du
 * travail : une saisie faite pendant une coupure de courant et jamais partie.
 * D'où l'avertissement chiffré avant de continuer. Le compte est volontairement
 * fait tous comptes confondus — voir `compterFileTotale`.
 */
export function DeconnexionButton() {
  const [enAttente, setEnAttente] = React.useState(0);

  React.useEffect(() => {
    let annule = false;
    compterFileTotale().then((n) => {
      if (!annule) setEnAttente(n);
    });
    return () => {
      annule = true;
    };
  }, []);

  return (
    <form
      action={seDeconnecterAction}
      onSubmit={(e) => {
        if (enAttente > 0) {
          const message =
            `${enAttente} écriture${enAttente > 1 ? 's' : ''} n'${enAttente > 1 ? 'ont' : 'a'} pas encore été ` +
            `envoyée${enAttente > 1 ? 's' : ''} au serveur. La déconnexion ${enAttente > 1 ? 'les' : 'la'} supprimera ` +
            `définitivement. Reconnectez-vous à Internet et attendez l'envoi avant de continuer.\n\n` +
            `Se déconnecter quand même ?`;
          if (!window.confirm(message)) {
            e.preventDefault();
            return;
          }
        }
        void effacerTousBrouillons();
      }}
    >
      <SubmitButton variant="secondary" size="sm" libelleEnCours="Déconnexion…">
        Déconnexion
      </SubmitButton>
    </form>
  );
}

'use client';

import * as React from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { lienPieceJointeReponseAction } from './actions';

/**
 * Télécharger le fichier que le support a joint à sa réponse.
 *
 * Composant client parce que la page qui l'accueille est rendue sur le
 * serveur : le lien signé se demande au clic, il ne peut pas être rendu dans
 * la page. Il expire au bout de cinq minutes, et une page gardée ouverte le
 * temps de lire la réponse porterait déjà un lien mort.
 *
 * **Le nom du fichier est le libellé du bouton.** Un « Télécharger » seul
 * oblige à cliquer pour savoir ce qu'on reçoit ; ici l'école reconnaît son
 * propre classeur avant même d'ouvrir quoi que ce soit.
 */
export function BoutonFichierReponse({
  demandeId,
  nomFichier,
}: {
  demandeId: string;
  nomFichier: string | null;
}) {
  const [enCours, setEnCours] = React.useState(false);
  const [erreur, setErreur] = React.useState<string | null>(null);

  async function telecharger() {
    setErreur(null);
    setEnCours(true);
    // Une Server Action interrompue peut se résoudre sur `undefined` sans
    // rejeter — voir `src/app/demarrage/appel-action.ts`. Sans cette enveloppe,
    // lire `.ok` dessus lèverait une erreur brute au lieu d'un message.
    let resultat: Awaited<ReturnType<typeof lienPieceJointeReponseAction>> | undefined;
    try {
      resultat = await lienPieceJointeReponseAction(demandeId);
    } catch {
      resultat = undefined;
    }
    setEnCours(false);

    if (!resultat || !resultat.ok || !resultat.url) {
      setErreur(resultat?.message ?? 'Téléchargement impossible. Vérifiez votre connexion.');
      return;
    }
    // Nouvel onglet : le fichier vient d'un stockage privé, par une URL signée
    // que le navigateur doit suivre telle quelle.
    window.open(resultat.url, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="mt-3">
      <Button size="sm" variant="secondary" disabled={enCours} onClick={telecharger}>
        <Download className="h-4 w-4" aria-hidden />
        {enCours ? 'Préparation…' : (nomFichier ?? 'Télécharger le fichier')}
      </Button>
      {erreur && <p className="mt-1.5 text-body-sm text-error">{erreur}</p>}
    </div>
  );
}

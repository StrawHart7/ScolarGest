'use server';

import { revalidatePath } from 'next/cache';
import { marquerAnnonceLue } from '@/services/annonce';

/**
 * « Ne plus afficher » au bas du lecteur d'annonce.
 *
 * ## Où ce bouton a le droit d'exister
 *
 * **Au bas du lecteur plein texte, et nulle part ailleurs.** La carte de la
 * barre latérale ne se ferme pas : c'est ce qui donne à une annonce sa durée,
 * et c'est la contrainte qu'on a tenue depuis le début. Ce qui change, c'est
 * qu'une fois le message ouvert et lu en entier, refuser le geste de le dire
 * transforme l'information en décor — et on apprend vite à sauter le décor.
 *
 * Il faut donc avoir ouvert pour pouvoir écarter. Le bouton ne raccourcit rien,
 * il constate.
 *
 * ## Ce que le geste écrit
 *
 * Une ligne par **personne**, pas par école : un collègue qui écarte ne fait
 * pas disparaître l'annonce pour les autres. La Régie en tire un dénombrement —
 * combien de personnes, combien d'écoles, sur combien d'écoles concernées — et
 * ne voit aucun identifiant.
 *
 * ## Elle ne lève pas
 *
 * Marquer comme lu est un confort. Si l'écriture échoue, l'annonce reste
 * affichée au prochain rendu : l'utilisateur réessaiera, et c'est une bien
 * meilleure issue qu'un message d'erreur sur un geste dont il se moque. Même
 * parti pris que la télémétrie — mais ici le repli est visible, donc il n'y a
 * rien de silencieux.
 *
 * `revalidatePath('/', 'layout')` : l'annonce est rendue par le layout, sur
 * toutes les pages. Revalider la seule route courante la laisserait affichée
 * partout ailleurs.
 */
export async function marquerAnnonceLueAction(evenementGlobalId: string): Promise<void> {
  try {
    await marquerAnnonceLue(evenementGlobalId);
    revalidatePath('/', 'layout');
  } catch {
    // Voir l'en-tête : l'annonce restera affichée, ce qui est le bon repli.
  }
}

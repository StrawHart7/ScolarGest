'use client';

import * as React from 'react';
import { prendreARejouer } from '@/lib/signalement-differe';
import { signalerErreurAction } from '@/app/erreur-actions';

/**
 * Renvoie les signalements d'erreur qui n'avaient pas pu partir.
 *
 * Monté une seule fois, dans `AppLayout`, comme le moteur de synchronisation :
 * le dépôt doit se vider dès qu'une page de l'application s'affiche
 * normalement, quelle qu'elle soit. Le poser sur un écran en particulier
 * supposerait que l'utilisateur y retourne.
 *
 * ## Pourquoi ce composant existe
 *
 * `src/app/error.tsx` signale l'erreur par une Server Action, donc par le
 * réseau. Quand la panne **est** le réseau — le cas le plus fréquent dans une
 * école togolaise pendant une coupure — l'appel échoue et le signalement est
 * perdu. Constaté en production le 2026-09-13 : « Failed to fetch » à 12:43, un
 * encaissement réussi à 12:47, et l'écran « Erreurs » de la Régie resté à zéro.
 *
 * Le raisonnement complet, et ce qu'on accepte en échange — l'horodatage du
 * rejeu plutôt que celui de l'erreur — vit dans `src/lib/signalement-differe.ts`.
 *
 * ## Ce qu'il ne fait pas
 *
 * Il ne rend rien, n'affiche rien, ne prévient de rien. Un signalement rejoué
 * n'est pas une information pour l'utilisateur : il a déjà vu l'erreur, et il
 * n'a rien à faire de savoir qu'un compteur s'est mis à jour quelque part.
 *
 * Il ne réessaie pas non plus. Si le rejeu échoue à son tour, le dépôt a déjà
 * été vidé et le signalement est perdu — c'est assumé. Réarmer produirait une
 * boucle dont personne ne surveille la fin, sur un canal dont la doctrine dit
 * qu'il n'est jamais sur le chemin critique.
 */
export function RejeuSignalements() {
  React.useEffect(() => {
    const enAttente = prendreARejouer();
    if (enAttente.length === 0) return;

    for (const signalement of enAttente) {
      void signalerErreurAction({
        nom: signalement.nom,
        chemin: signalement.chemin,
        reference: signalement.reference,
      }).catch(() => {
        // Rien. Voir l'en-tête : on ne réarme pas.
      });
    }
  }, []);

  return null;
}

'use client';

import type { ResultatEtape } from './actions';

/**
 * Enveloppe tout appel d'action du questionnaire de démarrage.
 *
 * Une Server Action ne renvoie pas toujours ce qu'on attend : si le réseau
 * tombe, ou si le serveur redémarre pendant la requête, l'appel se rejette —
 * ou pire, se résout sur `undefined`. Le code appelant faisait alors
 * `resultat.ok` sur `undefined` et l'étape se soldait par une erreur
 * d'exécution brute, illisible, à la place d'un message.
 *
 * Ce n'est pas un cas limite ici : l'application vise des établissements dont
 * la connexion est fréquemment coupée. Une interruption doit se dire
 * calmement et laisser la saisie intacte, pour être rejouée telle quelle.
 */
export async function appelerAction(
  appel: () => Promise<ResultatEtape | undefined>,
): Promise<ResultatEtape> {
  try {
    const resultat = await appel();
    if (!resultat || typeof resultat.ok !== 'boolean') {
      return {
        ok: false,
        message:
          "Le serveur n'a pas répondu. Vos saisies sont conservées : vérifiez votre connexion puis réessayez.",
      };
    }
    return resultat;
  } catch {
    return {
      ok: false,
      message:
        'Connexion interrompue. Vos saisies sont conservées : vérifiez votre connexion puis réessayez.',
    };
  }
}

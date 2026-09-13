'use server';

import { signalerErreurApplicative } from '@/services/telemetrie';

/**
 * Signalement d'une erreur applicative au plan de contrôle, depuis la frontière
 * d'erreur de l'espace applicatif.
 *
 * ## Pourquoi une action, et pourquoi ici
 *
 * `src/app/error.tsx` est un composant client : il ne peut pas importer
 * `src/services/`, qui tire `next/headers` dans le bundle et fait échouer la
 * compilation Next — le piège documenté dans `CLAUDE.md`, payé le 2026-09-02 et
 * de nouveau le 2026-09-12 sur le dépôt de la Régie. Un fichier `'use server'`,
 * lui, s'importe légalement depuis un composant client : Next remplace l'import
 * par un appel réseau.
 *
 * Le fichier vit à la racine de `src/app/` parce que la frontière d'erreur y
 * vit aussi. Même emplacement que `demande-demo-actions.ts`, pour la même
 * raison : la page qui s'en sert n'est pas dans un sous-dossier.
 *
 * ## Ce que l'action ne fait pas
 *
 * Elle ne valide rien et ne rend rien. Le bornage et le calcul de l'empreinte
 * vivent dans le service, donc du même côté que la garde de rôle : une
 * validation posée ici et une autre là-bas finiraient par diverger, et c'est
 * celle du service qui fait foi puisque rien n'oblige à passer par cette
 * action.
 *
 * Elle ne lève jamais non plus — le service avale déjà tout. C'est délibéré :
 * l'appelant est la dernière page utilisable de l'application, et une
 * exception remontée d'ici la remplacerait par un écran blanc.
 */
export async function signalerErreurAction(incident: {
  nom?: string | null;
  chemin?: string | null;
  reference?: string | null;
}): Promise<void> {
  await signalerErreurApplicative(incident);
}

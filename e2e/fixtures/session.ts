import { expect, type Page } from '@playwright/test';
import { join } from 'node:path';

/**
 * Connexion réutilisable pour les parcours authentifiés.
 *
 * Les identifiants viennent de l'environnement, jamais du dépôt : un mot de
 * passe versionné finit toujours par se retrouver ailleurs. Quand les variables
 * ne sont pas renseignées, les tests concernés se **sautent** au lieu
 * d'échouer — le dépôt reste clonable et vert sans secrets, et un `skip` visible
 * vaut mieux qu'un rouge permanent qu'on finit par ignorer.
 *
 * À renseigner dans `.env.e2e` ou dans l'environnement du shell :
 *   E2E_DIRECTEUR_EMAIL / E2E_DIRECTEUR_PASSWORD
 *   E2E_SECRETAIRE_EMAIL / E2E_SECRETAIRE_PASSWORD
 *   E2E_COMPTABLE_EMAIL / E2E_COMPTABLE_PASSWORD
 *   E2E_ENSEIGNANT_EMAIL / E2E_ENSEIGNANT_PASSWORD
 */

export type RoleTest = 'DIRECTEUR' | 'SECRETAIRE' | 'COMPTABLE' | 'ENSEIGNANT';

export interface Identifiants {
  email: string;
  motDePasse: string;
}

export function identifiants(role: RoleTest): Identifiants | null {
  const email = process.env[`E2E_${role}_EMAIL`];
  const motDePasse = process.env[`E2E_${role}_PASSWORD`];
  return email && motDePasse ? { email, motDePasse } : null;
}

/** Message de `test.skip` : dit précisément quoi renseigner pour l'activer. */
export function raisonAbsence(role: RoleTest): string {
  return `E2E_${role}_EMAIL / E2E_${role}_PASSWORD non renseignés — parcours ${role} non joué.`;
}

/**
 * Connecte la page et attend d'être réellement entré dans l'application.
 *
 * L'attente porte sur l'URL et non sur un élément : le tableau de bord diffère
 * selon le rôle, alors que la sortie de `/login` est le seul signal commun à
 * tous — et le seul qui distingue une connexion réussie d'un formulaire resté
 * en place avec un message d'erreur.
 */
export async function seConnecter(page: Page, role: RoleTest): Promise<void> {
  const compte = identifiants(role);
  if (!compte) throw new Error(raisonAbsence(role));

  await page.goto('/login');
  await page.getByLabel('Adresse e-mail').fill(compte.email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(compte.motDePasse);
  // Nom exact : la page porte aussi un bouton Google, qu'un motif large
  // attraperait au passage.
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();

  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
}

/**
 * Fichier de session d'un rôle, produit par `auth.setup.ts` et consommé par les
 * specs via `test.use({ storageState })`. Hors du dépôt : il contient un jeton
 * d'accès valide.
 */
export function cheminSession(role: RoleTest): string {
  return join(__dirname, '..', '.auth', `${role.toLowerCase()}.json`);
}

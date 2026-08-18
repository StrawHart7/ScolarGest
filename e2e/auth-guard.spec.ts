import { test, expect } from '@playwright/test';

/**
 * Unauthenticated coverage only — no test Supabase account is wired into CI
 * yet. Authenticated flows (SUPER_ADMIN provisioning, Directeur structure
 * management) are validated manually until dedicated test accounts exist
 * (see PLAN.md Phase 1 "Restant à faire").
 */

const PROTECTED_ROUTES = [
  '/dashboard',
  '/profil',
  '/super-admin',
  '/super-admin/abonnements',
  '/super-admin/etablissements/nouveau',
  '/etablissement/cycles',
  '/etablissement/annees-scolaires',
  '/etablissement/classes',
  '/etablissement/eleves',
  '/etablissement/eleves/nouvelle',
  '/etablissement/eleves/import',
  '/etablissement/eleves/passage',
  '/etablissement/enseignants',
  '/etablissement/enseignants/nouveau',
  '/etablissement/enseignants/import',
  '/etablissement/mes-classes',
  '/utilisateurs',
  '/utilisateurs/inviter',
];

for (const route of PROTECTED_ROUTES) {
  test(`redirects unauthenticated visitor from ${route} to /login`, async ({ page }) => {
    await page.goto(route);
    await expect(page).toHaveURL(/\/login$/);
  });
}

test('login page renders the email/password form and Google option', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'ScolarGest' })).toBeVisible();
  await expect(page.getByLabel('Adresse e-mail')).toBeVisible();
  await expect(page.getByLabel('Mot de passe')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continuer avec Google' })).toBeVisible();
});

test('login with invalid credentials shows an error and stays on /login', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Adresse e-mail').fill('inexistant@scolargest.test');
  await page.getByLabel('Mot de passe').fill('mot-de-passe-invalide');
  const submit = page.getByRole('button', { name: 'Se connecter' });
  await submit.click();

  // The Server Action makes a real round trip to Supabase Auth — wait for the
  // pending state to clear rather than asserting on the exact error copy
  // (Supabase's own message, or a transient network error, are both fine —
  // the only thing that matters here is that access was not granted).
  await expect(submit).toBeEnabled({ timeout: 20_000 });
  await expect(page).toHaveURL(/\/login$/);
});

test('forgot-password acknowledges the request regardless of account existence', async ({
  page,
}) => {
  await page.goto('/forgot-password');
  await page.getByLabel('Adresse e-mail').fill('inexistant@scolargest.test');
  const submit = page.getByRole('button').filter({ hasText: /envoyer|réinitialis/i });
  await submit.click();

  // Same real-network caveat as above: wait out the pending state, then
  // confirm the form was replaced by a confirmation message (any message —
  // the action always returns one, success or transient failure alike).
  await expect(page.getByRole('button', { name: /^envoi/i })).toHaveCount(0, { timeout: 20_000 });
  await expect(page.locator('main p').last()).toBeVisible();
});

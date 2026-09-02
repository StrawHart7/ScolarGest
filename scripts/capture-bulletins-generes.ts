/**
 * Ouvre réellement l'écran des bulletins édités et le capture.
 *
 * Un build vert ne dit rien d'une page rendue à la demande : elle n'est jamais
 * exécutée à la compilation. Ce script emprunte le chemin réel — connexion,
 * navigation, rendu — plutôt que de raisonner sur le code.
 *
 *   npx tsx scripts/capture-bulletins-generes.ts
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://localhost:3007';
const EMAIL = process.env.TEST_EMAIL ?? 'demo.kpi@scolargest.test';
const MOTDEPASSE = process.env.TEST_PASSWORD ?? 'DemoKpi2026!';

async function main() {
  const navigateur = await chromium.launch();
  const page = await navigateur.newPage({ viewport: { width: 1440, height: 900 } });
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(String(e)));

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', MOTDEPASSE);
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard|super-admin|demarrage/, { timeout: 60_000 });

  await page.goto(`${BASE}/etablissement/notes/bulletins/generes`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'capture-bulletins-generes.png', fullPage: true });

  const titre = await page.locator('h1').first().innerText();
  const lignes = await page.locator('tbody tr').count();
  const resume = await page.locator('p:has-text("bulletin(s) édité(s)")').first().innerText();

  await navigateur.close();
  console.log(`Titre : ${titre}`);
  console.log(`Résumé : ${resume}`);
  console.log(`Lignes du tableau : ${lignes}`);
  console.log(erreurs.length ? `Erreurs client : ${erreurs.join(' | ')}` : 'Aucune erreur client');
}

main();

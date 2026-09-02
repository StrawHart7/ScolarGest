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

// Les délais sont volontairement énormes : en développement, la première
// visite d'une route déclenche sa compilation webpack — `/dashboard` a mis
// 379 s sur cette machine. Un timeout court ferait conclure à tort que la
// connexion échoue, alors que le POST /login a bien renvoyé 303.

async function main() {
  const navigateur = await chromium.launch();
  const page = await navigateur.newPage({ viewport: { width: 1440, height: 900 } });
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(String(e)));

  page.setDefaultTimeout(600_000);
  page.setDefaultNavigationTimeout(600_000);
  // Jamais `networkidle` en développement : le websocket HMR garde une
  // connexion ouverte, l'attente expire alors que la page est déjà affichée.
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', MOTDEPASSE);
  await page.click('button[type="submit"]');
  try {
    await page.waitForURL(/dashboard|super-admin|demarrage/, { timeout: 600_000 });
  } catch {
    // Une connexion refusée laisse sur /login avec un message : le dire vaut
    // mieux qu'un « timeout » qui n'explique rien.
    await page.screenshot({ path: 'capture-login-echec.png', fullPage: true });
    console.log(`Connexion non aboutie. URL : ${page.url()}`);
    console.log(`Texte de la page : ${(await page.locator('body').innerText()).slice(0, 600)}`);
    await navigateur.close();
    return;
  }

  await page.goto(`${BASE}/etablissement/notes/bulletins/generes`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForSelector('h1', { timeout: 600_000 });
  await page.screenshot({ path: 'capture-bulletins-generes.png', fullPage: true });

  const titre = await page.locator('h1').first().innerText();
  const lignes = await page.locator('tbody tr').count();
  const resume = await page.locator('p:has-text("bulletin(s) prêt(s)")').first().innerText();

  await navigateur.close();
  console.log(`Titre : ${titre}`);
  console.log(`Résumé : ${resume}`);
  console.log(`Lignes du tableau : ${lignes}`);
  console.log(erreurs.length ? `Erreurs client : ${erreurs.join(' | ')}` : 'Aucune erreur client');
}

main();

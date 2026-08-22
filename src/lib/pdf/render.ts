import type { Browser } from 'playwright-core';

/**
 * Rendu HTML -> PDF via Chromium headless. Fonction isolée et réutilisable par
 * tous les documents PDF (bulletin, reçu, ...). Le HTML passé en entrée est un
 * document complet et autonome (pas de dépendance réseau requise sauf Google
 * Fonts, chargées via CDN dans les templates — best effort si l'environnement
 * de génération est hors-ligne).
 *
 * Deux environnements d'exécution, résolus au moment du lancement :
 *
 * - **Serverless** (Vercel / AWS Lambda) : aucun Chromium système n'est
 *   présent et le Chromium complet de Playwright (~300 Mo) dépasse la taille
 *   d'une fonction. On utilise le binaire packagé par `@sparticuz/chromium`,
 *   piloté par `playwright-core`.
 * - **Local / serveur persistant** : le Chromium installé par
 *   `npx playwright install chromium` (paquet `playwright` complet).
 *
 * **Un seul navigateur, réutilisé.** Relancer un Chromium à chaque bulletin
 * fait échouer toutes les générations après la première dans une fonction
 * serverless (le second lancement dans un conteneur déjà chaud sature la
 * mémoire et le `/tmp` de la fonction). On garde donc une instance chaude,
 * partagée entre les rendus et entre invocations tant que le conteneur vit ;
 * chaque rendu ouvre un contexte isolé et ne ferme que ce contexte. Si le
 * navigateur a été tué entre deux invocations, il est relancé à la volée.
 */
function estServerless(): boolean {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

async function creerNavigateur(): Promise<Browser> {
  if (estServerless()) {
    const chromiumPack = (await import('@sparticuz/chromium')).default;
    const { chromium } = await import('playwright-core');
    return chromium.launch({
      args: chromiumPack.args,
      executablePath: await chromiumPack.executablePath(),
      headless: true,
    });
  }

  // Dev / serveur avec le paquet `playwright` complet et son Chromium installé.
  const { chromium } = await import('playwright');
  return chromium.launch({ headless: true }) as unknown as Promise<Browser>;
}

// Instance partagée. La promesse mémorise un lancement en cours pour éviter que
// deux rendus concurrents ne lancent chacun leur navigateur.
let navigateurPromis: Promise<Browser> | null = null;

async function getNavigateur(): Promise<Browser> {
  if (navigateurPromis) {
    try {
      const navigateur = await navigateurPromis;
      if (navigateur.isConnected()) return navigateur;
    } catch {
      // Lancement précédent échoué : on repart d'un lancement neuf ci-dessous.
    }
    navigateurPromis = null;
  }

  navigateurPromis = creerNavigateur();
  return navigateurPromis;
}

/** Format A4, marges nulles (les templates gèrent leur propre padding). */
export async function renderHtmlToPdf(html: string): Promise<Buffer> {
  const navigateur = await getNavigateur();
  // Un contexte par rendu : isole les pages sans fermer le navigateur partagé.
  const contexte = await navigateur.newContext();
  try {
    const page = await contexte.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', bottom: '0', left: '0', right: '0' },
    });
    return Buffer.from(pdf);
  } finally {
    await contexte.close();
  }
}

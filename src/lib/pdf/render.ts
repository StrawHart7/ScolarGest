import { chromium } from 'playwright';

/**
 * Rendu HTML -> PDF via Chromium headless (Playwright). Fonction isolée et
 * réutilisable par tous les documents PDF (bulletin, reçu, ...). Le HTML
 * passé en entrée est un document complet et autonome (pas de dépendance
 * réseau requise sauf Google Fonts, chargées via CDN dans les templates —
 * best effort si l'environnement de génération est hors-ligne).
 *
 * Format A4, marges nulles (les templates gèrent leur propre padding).
 */
export async function renderHtmlToPdf(html: string): Promise<Buffer> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', bottom: '0', left: '0', right: '0' },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

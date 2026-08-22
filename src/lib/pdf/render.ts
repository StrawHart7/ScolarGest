import type { Browser } from 'playwright-core';

/**
 * Rendu HTML -> PDF via Chromium headless. Fonction isolée et réutilisable par
 * tous les documents PDF (bulletin, reçu, ...). Le HTML passé en entrée est un
 * document complet et autonome et n'utilise que des polices système : aucun
 * accès réseau n'est requis pendant le rendu.
 *
 * Deux environnements d'exécution, résolus au moment du lancement :
 *
 * - **Serverless** (Vercel / AWS Lambda) : binaire packagé par
 *   `@sparticuz/chromium`, piloté par `playwright-core`.
 * - **Local / serveur persistant** : Chromium du paquet `playwright`.
 *
 * **Un seul navigateur, réutilisé, mais jamais bloquant.** Relancer un Chromium
 * à chaque document est coûteux ; on garde donc une instance chaude. Mais sur
 * serverless le process peut être figé/tué entre deux invocations sans que la
 * connexion CDP ne le signale : toute opération est donc bornée par un délai,
 * et au moindre échec/dépassement on jette l'instance pour repartir neuf au
 * prochain appel. Ainsi un rendu échoue vite (erreur remontée) plutôt que de
 * consumer toute la fenêtre de la fonction.
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

  const { chromium } = await import('playwright');
  return chromium.launch({ headless: true }) as unknown as Promise<Browser>;
}

let navigateurPromis: Promise<Browser> | null = null;

async function getNavigateur(): Promise<Browser> {
  if (navigateurPromis) {
    try {
      const navigateur = await navigateurPromis;
      if (navigateur.isConnected()) return navigateur;
    } catch {
      // Lancement précédent échoué : relance ci-dessous.
    }
    navigateurPromis = null;
  }
  navigateurPromis = creerNavigateur();
  return navigateurPromis;
}

/** Ferme et oublie l'instance courante : le prochain rendu en relancera une. */
async function reinitialiserNavigateur(): Promise<void> {
  const promesse = navigateurPromis;
  navigateurPromis = null;
  if (!promesse) return;
  try {
    const navigateur = await promesse;
    await navigateur.close();
  } catch {
    // Déjà mort/déconnecté : rien à faire.
  }
}

function avecDelai<T>(promesse: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promesse,
    new Promise<T>((_, rejeter) => setTimeout(() => rejeter(new Error(message)), ms)),
  ]);
}

// Bornes volontairement bien en deçà de la fenêtre serverless (maxDuration) :
// un rendu qui traîne doit échouer et remonter une erreur, pas manger 60s.
const DELAI_LANCEMENT_MS = 30_000;
const DELAI_RENDU_MS = 20_000;

/** Format A4, marges nulles (les templates gèrent leur propre padding). */
export async function renderHtmlToPdf(html: string): Promise<Buffer> {
  try {
    const navigateur = await avecDelai(
      getNavigateur(),
      DELAI_LANCEMENT_MS,
      'Lancement de Chromium trop long (timeout).',
    );

    const contexte = await navigateur.newContext();
    try {
      const page = await contexte.newPage();
      page.setDefaultTimeout(DELAI_RENDU_MS);
      await page.setContent(html, { waitUntil: 'load', timeout: DELAI_RENDU_MS });
      const pdf = await avecDelai(
        page.pdf({
          format: 'A4',
          printBackground: true,
          margin: { top: '0', bottom: '0', left: '0', right: '0' },
        }),
        DELAI_RENDU_MS,
        'Rendu du PDF trop long (timeout).',
      );
      return Buffer.from(pdf);
    } finally {
      await contexte.close().catch(() => {});
    }
  } catch (erreur) {
    // Instance peut-être figée/morte : on repart neuf au prochain appel.
    await reinitialiserNavigateur();
    throw erreur;
  }
}

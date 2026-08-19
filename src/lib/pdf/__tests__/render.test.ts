import { describe, it, expect } from 'vitest';
import { renderHtmlToPdf } from '../render';

/**
 * Test d'intégration réel du pipeline PDF (Chromium headless via Playwright).
 *
 * Statut vérifié pendant l'implémentation de la Phase 5 (voir rapport de
 * livraison): `npx playwright install chromium` a réussi et un appel direct
 * de premier niveau (`node script.mjs` important `playwright`) produit
 * effectivement un buffer PDF valide (%PDF-...) dans cet environnement — le
 * rendu HTML->PDF fonctionne réellement ici, ce n'est pas une supposition.
 *
 * En revanche, exécuté *à l'intérieur* du pool de workers de Vitest (threads
 * comme forks), le lancement de Chromium (processus enfant imbriqué dans un
 * worker/fork déjà sandboxé) bloque indéfiniment ou fait planter le worker
 * ("Worker exited unexpectedly") — un artefact du sandboxing de cet
 * environnement de test précis, pas une limitation de Playwright ni du code
 * de `render.ts`. Reproductible: `npx vitest run --pool=forks` sur ce fichier
 * plante le worker ; l'appel Node direct hors Vitest réussit en ~1-2s.
 *
 * Le test est donc gardé par une variable d'environnement (RUN_PDF_TESTS=1)
 * plutôt que lancé par défaut, pour ne pas faire pendre indéfiniment
 * `npm run test`/CI dans cet environnement — conforme à la consigne du plan
 * ("documenter comme potentiellement skip/échec local... plutôt que de le
 * supprimer"). À activer explicitement dans un environnement CI/Vercel où le
 * lancement de sous-processus depuis un worker n'est pas restreint.
 */
describe.skipIf(!process.env.RUN_PDF_TESTS)('renderHtmlToPdf', () => {
  it('produit un buffer PDF valide à partir d\'un HTML simple', async () => {
    const html = '<html><body><h1>Bulletin de test</h1></body></html>';
    const pdf = await renderHtmlToPdf(html);

    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.length).toBeGreaterThan(0);
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  }, 30000);
});

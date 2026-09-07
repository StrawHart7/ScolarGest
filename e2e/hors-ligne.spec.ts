import { expect, test } from '@playwright/test';
import { cheminSession, identifiants, raisonAbsence } from './fixtures/session';

/**
 * Parcours de coupure reseau, joue par le chemin reel.
 *
 * Ce que les tests unitaires ne peuvent pas dire : que le formulaire intercepte
 * bien la soumission avant d'appeler la Server Action, que le bandeau apparait,
 * et que la file repart au retour du reseau. Trois choses qui ne se prouvent
 * que dans un navigateur.
 *
 * `context.setOffline(true)` coupe les requetes sortantes du contexte, ce qui
 * reproduit exactement ce que vit une ecole pendant une coupure : la page est
 * deja chargee, l'appareil fonctionne, plus rien ne sort.
 */

// Facture de demonstration sans aucun versement, sur « Les Victorieux ».
// Jamais l'ecole reelle : le test encaisse pour de bon.
const FACTURE = '947bd788-2b15-49d6-b73e-368756c5ef2e';

test.describe('encaissement hors ligne', () => {
  test.skip(identifiants('SECRETAIRE') === null, raisonAbsence('SECRETAIRE'));
  test.use({ storageState: cheminSession('SECRETAIRE') });

  test('met le versement en file, puis l’envoie au retour du reseau', async ({ page, context }) => {
    await page.goto(`/etablissement/finances/factures/${FACTURE}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const montant = page.locator('input[name="montant"]');
    await expect(montant).toBeVisible();

    // --- coupure ---
    await context.setOffline(true);

    // Le libelle du bouton doit changer : sans cela l'utilisateur croirait
    // l'argent encaisse.
    await expect(
      page.getByRole('button', { name: /Mettre l.encaissement en attente/i }),
    ).toBeVisible({ timeout: 15_000 });

    await montant.fill('1000');
    await page.getByRole('button', { name: /Mettre l.encaissement en attente/i }).click();

    await expect(page.getByText(/Encaissement mis en attente/i)).toBeVisible({ timeout: 15_000 });

    // Le bandeau global doit annoncer l'ecriture restante.
    await expect(page.getByText(/n.a pas encore ete envoyee au serveur/i)).toBeVisible({
      timeout: 15_000,
    });

    // --- retour du reseau ---
    //
    // Rien a cliquer : le fournisseur ecoute l'evenement `online` et vide la
    // file de lui-meme. La premiere version de ce test cliquait « Envoyer
    // maintenant » et echouait parce que le bouton avait deja disparu — le
    // bandeau s'etait retire tout seul. L'echec disait donc que la
    // fonctionnalite marchait mieux que le test ne le supposait.
    await context.setOffline(false);

    await expect(page.getByText(/n.a pas encore ete envoyee au serveur/i)).toBeHidden({
      timeout: 60_000,
    });
  });
});

test.describe('consultation hors ligne', () => {
  test.skip(identifiants('SECRETAIRE') === null, raisonAbsence('SECRETAIRE'));
  test.use({ storageState: cheminSession('SECRETAIRE') });

  test('sert une page deja visitee quand le reseau tombe', async ({ page, context }) => {
    // Avant ce travail, le service worker prevoyait ce repli mais ne mettait
    // jamais aucune navigation en cache : `caches.match` ne trouvait rien et
    // toute coupure menait a /offline, meme sur une page consultee une minute
    // plus tot.
    await page.goto('/etablissement/finances/factures');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Le service worker doit avoir pris la main : sans controleur, la page
    // n'est pas passee par lui et rien n'a ete mis en cache.
    await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller), null, {
      timeout: 30_000,
    });

    // Second passage : c'est celui-la qui traverse le service worker et
    // alimente le cache.
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await context.setOffline(true);
    await page.reload();

    // La page revient, et ce n'est pas la page de secours.
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 30_000 });
    await expect(page).not.toHaveURL(/\/offline/);
  });
});

test.describe('prechargement', () => {
  test.skip(identifiants('SECRETAIRE') === null, raisonAbsence('SECRETAIRE'));
  test.use({ storageState: cheminSession('SECRETAIRE') });

  test('ouvre une page jamais visitee, hors ligne', async ({ page, context }) => {
    // Le defaut signale le 2026-09-07 : hors ligne, changer de page menait a
    // l'ecran d'erreur du navigateur. Seules les pages deja ouvertes etaient
    // en cache, et personne ne visite chaque ecran « au cas ou » avant une
    // coupure de courant qui ne previent pas.
    await page.goto('/dashboard');
    await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller), null, {
      timeout: 30_000,
    });

    // Le prechargement part 4s apres le montage, puis telecharge par paquets
    // de quatre. On attend qu'une page jamais visitee soit reellement en
    // cache plutot qu'un delai fixe, qui serait flaky sur une machine lente.
    const CIBLE = '/etablissement/finances/tarifs';
    await page.waitForFunction(
      async (chemin) => {
        for (const nom of await caches.keys()) {
          const cache = await caches.open(nom);
          if (await cache.match(chemin)) return true;
        }
        return false;
      },
      CIBLE,
      { timeout: 60_000 },
    );

    await context.setOffline(true);
    await page.goto(CIBLE);

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Page non disponible hors connexion/i)).toBeHidden();
  });
});

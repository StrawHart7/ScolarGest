import { test, expect, type Page } from '@playwright/test';
import { cheminSession, identifiants, raisonAbsence, type RoleTest } from './fixtures/session';

/**
 * Pendant UI de la matrice de permissions.
 *
 * `src/lib/permissions/__tests__/matrice.test.ts` fige les gardes au niveau des
 * services ; ce fichier vérifie ce qu'un utilisateur constate réellement dans
 * son navigateur. Les deux sont nécessaires : une garde correcte derrière un
 * lien affiché à tort produit une impasse, et une garde oubliée derrière une
 * page qu'aucun menu ne présente reste une porte ouverte.
 *
 * Les attentes viennent du doc 08 § 17 pour la finance et de
 * `src/lib/navigation.ts` pour les menus — pas de l'intuition. La première
 * version de ce fichier a échoué trois fois, et les trois fois c'est
 * l'expectation qui avait tort, pas le produit : la Secrétaire a bien un accès
 * finance en lecture seule, et l'Enseignant a bien accès aux rapports.
 *
 * Ces tests ne créent aucune donnée — ils naviguent et observent.
 */

interface AttenteRole {
  role: RoleTest;
  menuAttendu: string[];
  menuInterdit: string[];
  /** Routes qui doivent être refusées, d'une manière ou d'une autre. */
  routesInterdites: string[];
  /** Routes accessibles, mais sans aucun moyen d'écrire. */
  routesLectureSeule?: string[];
}

const ATTENTES: AttenteRole[] = [
  {
    role: 'ENSEIGNANT',
    menuAttendu: ['Mes classes', 'Notes et résultats'],
    // Doc 08 § 17 : « ENSEIGNANT — aucun accès » à la finance.
    menuInterdit: ['Finances', 'Élèves'],
    routesInterdites: [
      '/etablissement/finances/factures',
      '/etablissement/finances/tarifs',
      '/utilisateurs',
      '/super-admin',
    ],
  },
  {
    role: 'COMPTABLE',
    menuAttendu: ['Finances', 'Élèves'],
    menuInterdit: ['Notes et résultats'],
    routesInterdites: ['/etablissement/notes/saisie', '/utilisateurs', '/super-admin'],
  },
  {
    role: 'SECRETAIRE',
    menuAttendu: ['Élèves', 'Notes et résultats'],
    menuInterdit: ['Finances'],
    routesInterdites: ['/super-admin'],
    // Doc 08 § 17 : « SECRETAIRE — lecture seule ». La page reste donc
    // atteignable par URL ; ce qui doit manquer, c'est tout moyen d'écrire.
    routesLectureSeule: ['/etablissement/finances/tarifs', '/etablissement/finances/types-frais'],
  },
];

/**
 * Une route refusée se manifeste de plusieurs façons selon la couche qui
 * bloque : redirection par le middleware, page d'erreur si une garde de service
 * lève, statut 4xx, ou refus explicite affiché par la page elle-même.
 *
 * Ce dernier cas est le plus soigné des quatre — `/etablissement/notes/saisie`
 * répond « Cette page est réservée aux comptes enseignants » plutôt que de
 * planter — et c'est justement celui qu'une première version de ce test
 * comptait à tort comme une fuite. Un refus poli reste un refus.
 */
const SIGNAUX_REFUS =
  /accès refusé|acces refuse|non autorisé|réservée aux|une erreur est survenue|une erreur s'est produite|application error/;

async function estRefusee(page: Page, route: string): Promise<boolean> {
  const reponse = await page.goto(route, { waitUntil: 'domcontentloaded' });

  if (!page.url().includes(route)) return true;
  if (reponse && reponse.status() >= 400) return true;

  // Attendre le signal plutôt que de lire une fois. Une garde de service lève
  // pendant le rendu : au moment de `domcontentloaded`, la frontière d'erreur
  // n'a pas encore remplacé le contenu. Une lecture unique concluait donc « la
  // page s'affiche » sur un refus parfaitement fonctionnel — un faux positif
  // de sécurité, le plus coûteux des deux sens.
  try {
    await expect
      .poll(async () => (await page.locator('body').innerText()).toLowerCase(), {
        timeout: 15_000,
      })
      .toMatch(SIGNAUX_REFUS);
    return true;
  } catch {
    return false;
  }
}

for (const attente of ATTENTES) {
  test.describe(`permissions du rôle ${attente.role}`, () => {
    test.skip(() => identifiants(attente.role) === null, raisonAbsence(attente.role));

    // Session ouverte une fois par `auth.setup.ts` : les tests repartent de
    // l'état enregistré au lieu de rejouer le formulaire de connexion, qui
    // représentait à lui seul l'essentiel des allers-retours de la suite.
    test.use({ storageState: cheminSession(attente.role) });

    test('voit exactement les entrées de menu de son rôle', async ({ page }) => {
      // Avec une session restaurée, la page démarre vierge : c'est la
      // connexion qui amenait auparavant sur le tableau de bord.
      await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

      const menu = page.getByRole('navigation');

      for (const entree of attente.menuAttendu) {
        await expect(
          menu.getByRole('link', { name: entree }),
          `${attente.role} devrait voir « ${entree} »`,
        ).toBeVisible();
      }

      for (const entree of attente.menuInterdit) {
        await expect(
          menu.getByRole('link', { name: entree }),
          `${attente.role} ne devrait pas voir « ${entree} »`,
        ).toHaveCount(0);
      }
    });

    for (const route of attente.routesInterdites) {
      test(`se voit refuser ${route}`, async ({ page }) => {
        expect(
          await estRefusee(page, route),
          `${route} s'est affichée pour ${attente.role} alors qu'elle devrait être refusée`,
        ).toBe(true);
      });
    }

    for (const route of attente.routesLectureSeule ?? []) {
      test(`accède à ${route} sans pouvoir y écrire`, async ({ page }) => {
        await page.goto(route, { waitUntil: 'domcontentloaded' });

        // La page doit s'ouvrir : la lecture seule est un droit, pas un refus.
        expect(await estRefusee(page, route)).toBe(false);

        // Et n'offrir aucune commande d'écriture. On vise les libellés
        // d'action plutôt qu'un sélecteur technique : c'est ce que
        // l'utilisateur voit, et donc ce qu'il pourrait cliquer.
        const commandes = page.getByRole('button', {
          name: /ajouter|nouveau|nouvelle|créer|enregistrer|modifier|supprimer/i,
        });
        await expect(
          commandes,
          `${attente.role} ne doit disposer d'aucune commande d'écriture sur ${route}`,
        ).toHaveCount(0);
      });
    }
  });
}

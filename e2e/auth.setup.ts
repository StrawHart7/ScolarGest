import { test as setup } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { cheminSession, identifiants, seConnecter, type RoleTest } from './fixtures/session';

/**
 * Ouvre une session par rôle, une seule fois, et l'enregistre sur disque.
 *
 * Auparavant chaque test se reconnectait dans son `beforeEach` : une vingtaine
 * d'allers-retours vers Supabase Auth, hébergé en Europe, pour une suite qui
 * n'en demande que quatre. Sous charge, l'un d'eux finissait par dépasser le
 * délai et faisait échouer un test qui n'avait rien à voir avec la connexion —
 * une suite qui clignote finit par être ignorée, ce qui est pire que pas de
 * suite du tout.
 *
 * Les rôles dont les identifiants sont absents sont simplement sautés ; les
 * tests correspondants le seront aussi.
 */

const ROLES: RoleTest[] = ['DIRECTEUR', 'SECRETAIRE', 'COMPTABLE', 'ENSEIGNANT'];

for (const role of ROLES) {
  setup(`ouvre une session ${role}`, async ({ page }) => {
    setup.skip(identifiants(role) === null, `identifiants ${role} absents`);

    await seConnecter(page, role);

    const chemin = cheminSession(role);
    mkdirSync(dirname(chemin), { recursive: true });
    await page.context().storageState({ path: chemin });
  });
}

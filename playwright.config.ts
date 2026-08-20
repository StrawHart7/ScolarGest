import { defineConfig, devices } from '@playwright/test';
import { config as chargerEnv } from 'dotenv';

// Identifiants des parcours authentifiés : hors du dépôt, dans un fichier
// ignoré par Git. Les tests concernés se sautent proprement quand il est
// absent (voir e2e/fixtures/session.ts), ce qui garde le dépôt clonable et
// vert sans secrets.
chargerEnv({ path: '.env.e2e' });

export default defineConfig({
  testDir: './e2e',
  // 60s plutôt que 30s : plusieurs tests traversent Supabase Auth hébergé en
  // Europe (connexion invalide, mot de passe oublié) et le middleware
  // interroge l'abonnement depuis la Phase 7. Sous 30s, ces tests-là
  // échouaient de façon intermittente sur la latence réseau, pas sur le code.
  timeout: 60_000,
  // Une seule reprise : distingue une vraie régression d'un aléa réseau, sans
  // masquer un test réellement cassé (qui échouera deux fois).
  retries: 1,
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3100',
    trace: 'on-first-retry',
  },
  projects: [
    // Ouvre une session par rôle avant tout le reste, et l'enregistre sur
    // disque. Les specs authentifiées repartent de cet état au lieu de rejouer
    // le formulaire de connexion à chaque test.
    { name: 'setup', testMatch: /auth[.]setup[.]ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    // Dedicated port + production server: avoids colliding with a `next dev`
    // instance already running on 3000, and avoids dev-mode's per-route
    // cold-compile lag (30s+ on first hit), which made these tests flaky.
    command: 'npx next start -p 3100',
    url: 'http://localhost:3100',
    // Réutiliser un serveur déjà lancé sur 3100. Le commentaire d'origine
    // interdisait la réutilisation pour ne pas tester par erreur contre le
    // `next dev` du développeur — mais celui-ci écoute sur 3000. Sur ce port
    // dédié, un serveur present ne peut être qu'un serveur de test, et le
    // démarrage à froid coûte ici plus de trois minutes : le payer à chaque
    // exécution rendait la suite inutilisable en local.
    reuseExistingServer: true,
    // 300s : le démarrage du serveur de production prend une centaine de
    // secondes sur cette machine (hook d'instrumentation Sentry + première
    // requête à froid), et la premiere reponse une vingtaine de plus. À 180s,
    // la suite échouait sur le démarrage sans qu'aucun test ne s'exécute —
    // un rouge qui ne disait rien du produit.
    timeout: 300_000,
  },
});

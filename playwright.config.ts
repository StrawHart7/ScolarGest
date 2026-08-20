import { defineConfig, devices } from '@playwright/test';

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
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Dedicated port + production server: avoids colliding with a `next dev`
    // instance already running on 3000, and avoids dev-mode's per-route
    // cold-compile lag (30s+ on first hit), which made these tests flaky.
    command: 'npx next start -p 3100',
    url: 'http://localhost:3100',
    reuseExistingServer: false,
    timeout: 180_000,
  },
});

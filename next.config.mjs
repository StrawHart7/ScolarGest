import { withSentryConfig } from '@sentry/nextjs';
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
    // Chromium (génération PDF) et ses variantes ne doivent pas être empaquetés
    // par webpack : ils embarquent des binaires natifs et des assets brotli
    // chargés depuis node_modules à l'exécution. Les empaqueter casse le
    // lancement. (Clé `experimental` en Next 14 ; stabilisée en Next 15.)
    serverComponentsExternalPackages: ['playwright', 'playwright-core', '@sparticuz/chromium'],
    // Externaliser ne suffit pas sur Vercel : le tracing de fichiers omet les
    // assets brotli de `@sparticuz/chromium` (dossier `bin/*.br`, lus à
    // l'exécution, jamais `require`d) — d'où « The input directory
    // .../@sparticuz/chromium/bin does not exist ». On force leur inclusion
    // dans chaque fonction qui génère un PDF (bulletins, reçus, export
    // rapports).
    outputFileTracingIncludes: {
      // Chaque cle ci-dessous fait entrer **67 Mo** de binaires Chromium dans le
      // bundle de la fonction correspondante. Les deux entrees precedentes
      // etaient des globs — `/etablissement/eleves/**` et
      // `/etablissement/finances/**` — qui couvraient treize routes alors que
      // deux seulement generent un PDF. Onze fonctions transportaient donc
      // 67 Mo pour rien : environ 1 Go par deploiement au lieu de 335 Mo.
      //
      // Ne jamais elargir en glob pour « etre tranquille » : le stockage des
      // fonctions se facture en Go-mois sur le maximum quotidien, et il se
      // cumule sur tous les deploiements conserves.
      //
      // Le `*` remplace un segment dynamique et **n'est pas** ecrit `[id]` :
      // en glob, des crochets designent une classe de caracteres.
      '/etablissement/notes/bulletins': ['./node_modules/@sparticuz/chromium/bin/**'],
      // Bouton « regenerer » : l'action vient de `notes/bulletins/actions` mais
      // s'execute dans la fonction de la page qui l'invoque.
      '/etablissement/eleves/*/bulletins': ['./node_modules/@sparticuz/chromium/bin/**'],
      // Emission du recu d'un paiement.
      '/etablissement/finances/factures/*': ['./node_modules/@sparticuz/chromium/bin/**'],
      '/api/rapports/export': ['./node_modules/@sparticuz/chromium/bin/**'],
      '/api/emploi-du-temps': ['./node_modules/@sparticuz/chromium/bin/**'],
    },
    // `lucide-react` expose des milliers d'icônes en modules séparés : sans
    // cette option, un `import { Users } from 'lucide-react'` fait traverser
    // tout le paquet au bundler. C'est le poste de compilation le plus lourd
    // en développement, où chaque route est compilée à la premiere visite.
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },
  eslint: {
    dirs: ['src'],
  },
  /**
   * En-têtes de sécurité — aucun n'existait avant le 2026-09-17.
   *
   * Ce qui est ici est volontairement ce dont l'effet est **certain sans avoir
   * à ouvrir l'application** : aucun ne restreint le chargement de scripts, de
   * styles ou d'images, donc aucun ne peut casser une page.
   *
   * `frame-ancestors 'none'` plutôt que `X-Frame-Options` : même effet, mais
   * c'est la directive que les navigateurs récents honorent, et elle couvre les
   * cadres imbriqués que l'en-tête historique laissait passer. Sans elle,
   * `/login` peut être chargée dans un cadre invisible sur un site tiers et
   * recevoir les frappes d'un visiteur qui croit cliquer ailleurs. C'est le
   * seul écran du produit où l'on tape un mot de passe.
   *
   * `Referrer-Policy` n'est pas décoratif ici : une invitation et une
   * réinitialisation de mot de passe arrivent sur `/auth/callback` avec le
   * `token_hash` **dans l'URL**. Sans politique, cette URL complète part en
   * `Referer` vers toute origine tierce que la page contacte — le jeton avec.
   *
   * Ce qui manque encore, et pourquoi : une CSP sur `script-src`. Elle demande
   * de recenser les sources réelles (Next, Sentry, FedaPay) et de la constater
   * sur une page rendue. Posée au jugé, elle casse l'application en silence
   * chez l'utilisateur et pas chez nous. Elle se tranche sur une preview.
   */
  async headers() {
    return [
      {
        source: '/:chemin*',
        headers: [
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: 'hartkitco',

  project: 'scolargest',

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // Le build ne doit pas dependre de la disponibilite de sentry.io. Le
  // 2026-09-01, `sentry-cli releases new` est reste bloque 3 minutes 26 avant
  // de recevoir un 504 « Downstream timeout » : un incident chez Sentry
  // immobilisait un deploiement qui n'avait aucune erreur de compilation.
  //
  // `errorHandler` degrade ces echecs en avertissement. Perdre les source maps
  // d'un deploiement rend une trace moins lisible ; perdre le deploiement
  // empeche de livrer.
  errorHandler: (erreur) => {
    console.warn('[sentry] envoi des source maps ignore :', erreur.message);
  },

  // Un appel reseau de moins au moment le plus fragile du build.
  telemetry: false,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: '/monitoring',

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});

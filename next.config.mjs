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
      '/etablissement/notes/bulletins': ['./node_modules/@sparticuz/chromium/bin/**'],
      '/etablissement/eleves/**': ['./node_modules/@sparticuz/chromium/bin/**'],
      '/etablissement/finances/**': ['./node_modules/@sparticuz/chromium/bin/**'],
      '/api/rapports/export': ['./node_modules/@sparticuz/chromium/bin/**'],
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
};

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: 'hartkitco',

  project: 'scolargest',

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

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

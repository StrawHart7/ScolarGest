import type { MetadataRoute } from 'next';

/**
 * Manifeste PWA généré par Next (route `/manifest.webmanifest`). Remplace le
 * `public/assets/icons/site.webmanifest` statique, dont le name/short_name
 * étaient vides et dont les icônes pointaient vers la racine alors que les
 * fichiers vivent sous `/assets/icons/`.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ScolarGest',
    short_name: 'ScolarGest',
    description: 'Gestion scolaire pour établissements privés',
    lang: 'fr',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f8f9fb',
    theme_color: '#0052cc',
    icons: [
      {
        src: '/assets/icons/android-chrome-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/assets/icons/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/assets/icons/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}

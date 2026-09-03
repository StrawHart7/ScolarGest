import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { PwaInstaller } from '@/components/pwa/pwa-installer';
import { ConnectivityProvider } from '@/components/connectivity/connectivity-context';
import { ConnectivityBanner } from '@/components/connectivity/connectivity-banner';
import { ScrollbarAutoHide } from '@/components/layout/ScrollbarAutoHide';

/**
 * Polices auto-hebergees.
 *
 * `next/font/google` telechargeait les fichiers **pendant le build**. Le
 * 2026-09-01, un `ECONNRESET` sur `fonts.gstatic.com` a laisse le build tourner
 * pendant vingt minutes en reessais. Un build ne doit dependre d'aucun service
 * tiers.
 *
 * Rien ne change pour l'utilisateur final : `next/font/google` servait deja les
 * fichiers depuis notre propre domaine (`_next/static/media/`), jamais depuis
 * Google. Seule l'origine au moment du build change — le depot au lieu du
 * reseau — et la sortie est identique.
 *
 * Les deux `.woff2` sont les sous-ensembles latins **variables** produits par
 * Next lui-meme : les reprendre tels quels garantit un rendu identique, plutot
 * qu'une version retelechargee qui pourrait differer.
 *
 * `unicode-range` reproduit celui que Next generait. Sans lui, un caractere
 * absent du sous-ensemble latin s'afficherait en carre vide au lieu de tomber
 * proprement sur la police de repli. La plage est repetee mot pour mot dans
 * les deux appels : le chargeur de polices de Next exige des litteraux et
 * refuse de compiler si la valeur vient d'une constante partagee.
 *
 * Inter et JetBrains Mono sont sous SIL Open Font License — voir
 * `src/app/fonts/OFL.txt`.
 */
const inter = localFont({
  src: './fonts/inter-latin-var.woff2',
  variable: '--font-inter',
  display: 'swap',
  weight: '100 900',
  style: 'normal',
  declarations: [
    {
      prop: 'unicode-range',
      value:
        'u+00??,u+0131,u+0152-0153,u+02bb-02bc,u+02c6,u+02da,u+02dc,u+0304,u+0308,u+0329,u+2000-206f,u+20ac,u+2122,u+2191,u+2193,u+2212,u+2215,u+feff,u+fffd',
    },
  ],
});

const mono = localFont({
  src: './fonts/jetbrains-mono-latin-var.woff2',
  variable: '--font-mono',
  display: 'swap',
  weight: '100 800',
  style: 'normal',
  declarations: [
    {
      prop: 'unicode-range',
      value:
        'u+00??,u+0131,u+0152-0153,u+02bb-02bc,u+02c6,u+02da,u+02dc,u+0304,u+0308,u+0329,u+2000-206f,u+20ac,u+2122,u+2191,u+2193,u+2212,u+2215,u+feff,u+fffd',
    },
  ],
});

export const metadata: Metadata = {
  title: {
    default: 'ScolarGest',
    template: '%s · ScolarGest',
  },
  description: 'Gestion scolaire multi-tenant',
  applicationName: 'ScolarGest',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/assets/icons/favicon.ico', sizes: 'any' },
      { url: '/assets/icons/favicon-16x16.png', type: 'image/png', sizes: '16x16' },
      { url: '/assets/icons/favicon-32x32.png', type: 'image/png', sizes: '32x32' },
    ],
    apple: [{ url: '/assets/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ScolarGest',
  },
};

export const viewport: Viewport = {
  themeColor: '#0052cc',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${inter.variable} ${mono.variable}`}>
      <body className="font-sans antialiased">
        <ConnectivityProvider>
          {children}
          <ConnectivityBanner />
        </ConnectivityProvider>
        <PwaInstaller />
        <ScrollbarAutoHide />
      </body>
    </html>
  );
}

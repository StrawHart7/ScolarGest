import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { PwaInstaller } from '@/components/pwa/pwa-installer';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });

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
        {children}
        <PwaInstaller />
      </body>
    </html>
  );
}

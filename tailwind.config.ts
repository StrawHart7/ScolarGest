import type { Config } from 'tailwindcss';

// Tokens from Docs/DESIGN.md (Luminous Institutional).
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#f8f9fb',
          dim: '#d9dadc',
          bright: '#f8f9fb',
          container: {
            lowest: '#ffffff',
            low: '#FBFBFC',
            DEFAULT: '#edeef0',
            high: '#e7e8ea',
            highest: '#e1e2e4',
          },
          variant: '#e1e2e4',
          border: '#DFE1E6',
          tint: '#0c56d0',
        },
        'on-surface': {
          DEFAULT: '#191c1e',
          variant: '#434654',
        },
        'inverse-surface': '#2e3132',
        'inverse-on-surface': '#f0f1f3',
        outline: {
          DEFAULT: '#737685',
          variant: '#c3c6d6',
        },
        primary: {
          DEFAULT: '#003d9b',
          container: '#0052cc',
          on: '#ffffff',
          'on-container': '#c4d2ff',
          fixed: '#dae2ff',
          'fixed-dim': '#b2c5ff',
          'on-fixed': '#001848',
          'on-fixed-variant': '#0040a2',
        },
        'inverse-primary': '#b2c5ff',
        secondary: {
          DEFAULT: '#4f5f7b',
          container: '#cdddff',
          on: '#ffffff',
          'on-container': '#51617e',
          fixed: '#d6e3ff',
          'fixed-dim': '#b7c7e8',
          'on-fixed': '#091c35',
          'on-fixed-variant': '#374763',
        },
        tertiary: {
          DEFAULT: '#004e33',
          container: '#056846',
          on: '#ffffff',
          'on-container': '#91e4b9',
          fixed: '#a0f4c8',
          'fixed-dim': '#85d7ad',
          'on-fixed': '#002113',
          'on-fixed-variant': '#005236',
        },
        /**
         * Avertissement.
         *
         * La couleur existait deja, mais en `amber-*` brut dans quinze
         * fichiers, avec trois opacites differentes pour le meme sens
         * (`/5`, `/10`, `/15` en fond ; `/20`, `/30`, `/40` en bordure). Les
         * valeurs reprennent exactement `amber-500` et `amber-700` deja
         * employes : le rendu ne change pas, le vocabulaire est unifie.
         *
         * Ce n'est pas `error` : une echeance qui approche, un import a
         * verifier ou une classe en surcapacite ne sont pas des fautes.
         */
        warning: {
          DEFAULT: '#f59e0b',
          'on-container': '#b45309',
        },
        error: {
          DEFAULT: '#ba1a1a',
          container: '#ffdad6',
          on: '#ffffff',
          'on-container': '#93000a',
        },
        background: '#f8f9fb',
        'on-background': '#191c1e',
        'text-primary': '#172B4D',
        'text-secondary': '#44546F',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'monospace'],
      },
      fontSize: {
        // Titre de page : responsive par nature. ~20px sur mobile étroit,
        // plafonné à 24px dès ~480px. Un seul token qui adapte tous les titres
        // de page au mobile sans surcharge par page.
        'display-sm': [
          'clamp(1.25rem, 5vw, 1.5rem)',
          { lineHeight: '1.3', letterSpacing: '-0.02em', fontWeight: '600' },
        ],
        'headline-md': ['18px', { lineHeight: '24px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'headline-sm': ['16px', { lineHeight: '24px', fontWeight: '600' }],
        'body-md': ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'body-sm': ['13px', { lineHeight: '18px', fontWeight: '400' }],
        'label-md': ['12px', { lineHeight: '16px', letterSpacing: '0.02em', fontWeight: '600' }],
        'data-mono': ['12px', { lineHeight: '16px', fontWeight: '400' }],

        // Échelle tactile. Elle s'ajoute à l'échelle dense ci-dessus, elle ne
        // la remplace pas : le desktop reste un outil de bureau à haute
        // densité, le téléphone est tenu à bout de bras. Les deux cohabitent
        // parce qu'elles ne portent pas les mêmes noms — une page qui n'a pas
        // été reprise garde exactement le rendu qu'elle avait.
        //
        // Le plancher est 12px. Le relevé du 2026-09-04 a trouvé du texte à
        // 10px sur 14 pages et à 11px sur 28, sous le plus petit token de
        // l'échelle : ces valeurs étaient écrites en dur, hors système.
        'touch-body': ['15px', { lineHeight: '22px', fontWeight: '400' }],
        'touch-label': ['13px', { lineHeight: '18px', fontWeight: '600' }],
        'touch-meta': ['12px', { lineHeight: '16px', fontWeight: '400' }],
        'touch-figure': [
          '28px',
          { lineHeight: '30px', letterSpacing: '-0.02em', fontWeight: '700' },
        ],
      },
      borderRadius: {
        sm: '0.125rem',
        DEFAULT: '0.25rem',
        md: '0.375rem',
        lg: '0.5rem',
        xl: '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      spacing: {
        sidebar: '260px',
        'sidebar-rail': '72px',
        header: '56px',
        'container-pad': '24px',
        gutter: '16px',
        'row-dense': '32px',
        'row-standard': '44px',
        // Dégagement sous une page qui porte une barre d'action collée en bas :
        // 56px de barre d'onglets, 24px de décalage, la barre d'action et
        // l'encoche. `row-standard` reste la hauteur de cible tactile — pas de
        // token `h-touch` en doublon, la valeur existe déjà et vaut 44px.
        'zone-action': 'calc(5.5rem + env(safe-area-inset-bottom, 0px))',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'fade-out': { from: { opacity: '1' }, to: { opacity: '0' } },
        'dialog-in': {
          from: { opacity: '0', transform: 'translate(-50%, -48%) scale(0.97)' },
          to: { opacity: '1', transform: 'translate(-50%, -50%) scale(1)' },
        },
        'toast-in': {
          from: { opacity: '0', transform: 'translateX(16px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'ring-pulse': {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.55' },
          '50%': { transform: 'scale(1.18)', opacity: '0' },
        },
        'mark-breathe': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.06)' },
        },
        'loader-sweep': {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        'banniere-in': {
          from: { opacity: '0', transform: 'translateY(-0.5rem)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'orbit-fade': {
          '0%, 100%': { opacity: '0.25' },
          '50%': { opacity: '1' },
        },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'fade-out': 'fade-out 120ms ease-in forwards',
        'dialog-in': 'dialog-in 180ms cubic-bezier(0.16, 1, 0.3, 1)',
        'toast-in': 'toast-in 180ms cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-up': 'slide-up 200ms ease-out',
        shimmer: 'shimmer 1.8s ease-in-out infinite',
        'ring-pulse': 'ring-pulse 2.2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'mark-breathe': 'mark-breathe 2.2s ease-in-out infinite',
        'loader-sweep': 'loader-sweep 2.4s linear infinite',
        'banniere-in': 'banniere-in 220ms cubic-bezier(0.16, 1, 0.3, 1)',
        'orbit-fade': 'orbit-fade 1.6s ease-in-out infinite',
      },
      boxShadow: {
        floating: '0px 4px 12px rgba(9, 30, 66, 0.08)',
        premium: '0 20px 40px -10px rgba(0, 41, 109, 0.1), 0 10px 20px -5px rgba(0, 41, 109, 0.05)',
        glow: '0 0 20px rgba(0, 41, 109, 0.15)',
        subtle: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
      },
    },
  },
  plugins: [],
};

export default config;

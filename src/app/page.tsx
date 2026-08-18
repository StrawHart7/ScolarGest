import Link from 'next/link';
import {
  ArrowRight,
  GraduationCap,
  Users,
  Wallet,
  ClipboardCheck,
  BookOpenCheck,
  FileText,
  ShieldCheck,
  Layers,
  Lock,
  KeyRound,
  History,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Reveal } from '@/components/motion/Reveal';
import { DemandeDemoForm } from '@/components/marketing/DemandeDemoForm';

const MODULES = [
  {
    icon: Users,
    title: 'Élèves & inscriptions',
    description:
      "Dossier élève complet, responsables légaux, inscription annuelle et passage de classe automatisé selon la progression officielle des niveaux.",
  },
  {
    icon: GraduationCap,
    title: 'Enseignants & affectations',
    description:
      'Comptes enseignants dédiés, affectation par classe et matière, titularité — chacun ne saisit que ce qui le concerne.',
  },
  {
    icon: BookOpenCheck,
    title: 'Notes & bulletins',
    description:
      'Saisie des notes, coefficients par année scolaire, calcul des moyennes fiabilisé par des tests automatisés, bulletins PDF officiels.',
  },
  {
    icon: Wallet,
    title: 'Finance & scolarité',
    description:
      'Facturation générée automatiquement à l’inscription, suivi des versements, reçus de paiement, tarifs immuables et historisés.',
  },
  {
    icon: Layers,
    title: 'Structure scolaire',
    description:
      'Cycles, niveaux, séries et classes conformes au système togolais, années scolaires historisées, une seule année active à la fois.',
  },
  {
    icon: ClipboardCheck,
    title: 'Rôles & permissions',
    description:
      '5 rôles fixes — Directeur, Secrétaire, Comptable, Enseignant, Super Admin — chacun avec un accès strictement délimité.',
  },
  {
    icon: FileText,
    title: 'Documents officiels',
    description:
      'Bulletins, reçus et rapports générés en PDF, numérotés et archivés — jamais recréés à l’identique après coup.',
  },
  {
    icon: ShieldCheck,
    title: 'Audit & traçabilité',
    description:
      'Chaque action sensible — paiement, validation de note, création de compte — laisse une trace horodatée et infalsifiable.',
  },
];

const SECURITY_POINTS = [
  {
    icon: Lock,
    title: 'Isolation stricte par établissement',
    description:
      'Chaque école est isolée au niveau de la base de données (Row Level Security PostgreSQL), pas seulement dans le code applicatif.',
  },
  {
    icon: KeyRound,
    title: 'Double authentification métier',
    description:
      'Connexion sécurisée + PIN d’approbation à 6 chiffres pour les actions sensibles (validation de paiement, correction de note verrouillée).',
  },
  {
    icon: History,
    title: 'Historisation totale',
    description:
      'Tarifs, coefficients et affectations sont rattachés à leur année scolaire. Rien n’écrase jamais un document déjà émis.',
  },
  {
    icon: ShieldCheck,
    title: 'Aucune suppression destructive',
    description:
      'Paiements, notes, factures et inscriptions ne sont jamais supprimés — seulement annulés ou archivés, traçabilité garantie.',
  },
];

const ROLES = [
  { name: 'Directeur', description: 'Vue d’ensemble de l’établissement, validation des décisions clés.' },
  { name: 'Secrétaire', description: 'Inscriptions, dossiers élèves, gestion administrative au quotidien.' },
  { name: 'Comptable', description: 'Facturation, paiements, suivi financier de l’établissement.' },
  { name: 'Enseignant', description: 'Saisie des notes et suivi de ses classes et matières affectées.' },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-on-surface antialiased">
      <header className="fixed top-0 z-50 w-full border-b border-surface-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:h-[72px] sm:px-6 lg:px-container-pad">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-surface-tint shadow-md transition-shadow duration-300 hover:shadow-glow sm:h-10 sm:w-10">
              <GraduationCap className="h-5 w-5 text-white sm:h-6 sm:w-6" aria-hidden />
            </div>
            <span className="text-lg font-bold tracking-tight text-primary sm:text-xl">
              Scolar<span className="font-semibold text-surface-tint">Gest</span>
            </span>
          </div>
          <nav className="hidden items-center gap-8 lg:flex">
            <a
              href="#modules"
              className="text-sm font-medium text-text-secondary transition-colors hover:text-primary"
            >
              Fonctionnalités
            </a>
            <a
              href="#securite"
              className="text-sm font-medium text-text-secondary transition-colors hover:text-primary"
            >
              Sécurité
            </a>
            <a
              href="#roles"
              className="text-sm font-medium text-text-secondary transition-colors hover:text-primary"
            >
              Rôles
            </a>
          </nav>
          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              href="/login"
              className="text-xs font-medium text-primary transition-colors hover:text-primary-container sm:text-sm"
            >
              Connexion
            </Link>
            <Button
              asChild
              size="sm"
              className="transition-transform duration-200 hover:-translate-y-0.5 sm:h-10 sm:px-4 sm:text-sm"
            >
              <a href="#demo">
                <span className="sm:hidden">Démo</span>
                <span className="hidden sm:inline">Demander une démo</span>
              </a>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-grow pt-16 sm:pt-[72px]">
        {/* Hero */}
        <section className="relative overflow-hidden px-4 py-16 sm:px-6 sm:py-20 lg:px-container-pad lg:py-24">
          <div className="pointer-events-none absolute right-0 top-0 h-[400px] w-[400px] -translate-y-1/4 translate-x-1/4 rounded-full bg-primary-fixed/30 blur-[100px] sm:h-[700px] sm:w-[700px] sm:blur-[120px]" />
          <div className="pointer-events-none absolute bottom-0 left-0 h-[300px] w-[300px] -translate-x-1/4 translate-y-1/4 rounded-full bg-tertiary-fixed/20 blur-[80px] sm:h-[500px] sm:w-[500px] sm:blur-[100px]" />
          <div className="relative z-10 mx-auto flex max-w-7xl flex-col items-center gap-10 lg:flex-row lg:gap-16">
            <Reveal className="flex flex-col gap-6 text-center lg:w-1/2 lg:gap-8 lg:text-left">
              <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-surface-border bg-surface-container-lowest/80 px-3 py-1.5 shadow-subtle backdrop-blur-sm sm:px-4 sm:py-2 lg:mx-0">
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-surface-tint opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-primary sm:text-xs">
                  Conçu pour les écoles privées togolaises
                </span>
              </div>
              <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight text-text-primary sm:text-5xl lg:text-6xl">
                La gestion scolaire,
                <br />
                <span className="bg-gradient-to-br from-primary to-surface-tint bg-clip-text text-transparent">
                  enfin unifiée.
                </span>
              </h1>
              <p className="mx-auto max-w-lg text-base leading-relaxed text-text-secondary sm:text-lg lg:mx-0">
                Élèves, enseignants, notes, finances et documents officiels dans une seule
                plateforme sécurisée — pensée pour la réalité des établissements privés au
                Togo, dès l’inscription jusqu’au bulletin.
              </p>
              <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-center lg:justify-start">
                <Button
                  size="lg"
                  asChild
                  className="h-12 w-full px-8 shadow-lg shadow-primary/25 transition-transform duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/30 sm:w-auto"
                >
                  <a href="#demo">
                    Demander une démo
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </a>
                </Button>
                <Button
                  size="lg"
                  variant="secondary"
                  asChild
                  className="h-12 w-full px-8 transition-transform duration-300 hover:-translate-y-1 sm:w-auto"
                >
                  <Link href="/login">Se connecter</Link>
                </Button>
              </div>
            </Reveal>

            <Reveal delayMs={150} className="relative w-full lg:w-1/2">
              <div className="absolute inset-0 rotate-2 scale-105 rounded-2xl bg-gradient-to-tr from-primary/10 via-surface-tint/5 to-transparent" />
              <div className="animate-float relative overflow-hidden rounded-2xl border border-surface-border/60 bg-surface-container-lowest shadow-premium transition-transform duration-700 hover:-translate-y-2">
                <div className="flex items-center gap-2 border-b border-surface-border bg-surface/80 px-3 py-2.5 sm:px-4 sm:py-3">
                  <div className="h-2.5 w-2.5 rounded-full bg-error/80 sm:h-3 sm:w-3" />
                  <div className="h-2.5 w-2.5 rounded-full bg-amber-400/80 sm:h-3 sm:w-3" />
                  <div className="h-2.5 w-2.5 rounded-full bg-tertiary-fixed/80 sm:h-3 sm:w-3" />
                  <div className="ml-3 flex-grow truncate rounded-md bg-surface-container px-2 py-1 text-center font-mono text-[9px] text-text-secondary sm:px-4 sm:text-[10px]">
                    app.scolargest.com/dashboard
                  </div>
                </div>
                <div className="flex flex-col gap-3 p-5 sm:gap-4 sm:p-8">
                  <div className="h-4 w-1/3 rounded bg-surface-container-high" />
                  <div className="grid grid-cols-3 gap-3 sm:gap-4">
                    <div className="h-14 rounded-lg bg-primary/10 transition-colors duration-500 hover:bg-primary/20 sm:h-20" />
                    <div className="h-14 rounded-lg bg-tertiary/10 transition-colors duration-500 hover:bg-tertiary/20 sm:h-20" />
                    <div className="h-14 rounded-lg bg-secondary/10 transition-colors duration-500 hover:bg-secondary/20 sm:h-20" />
                  </div>
                  <div className="h-24 rounded-lg bg-surface-container-high sm:h-32" />
                  <div className="h-4 w-2/3 rounded bg-surface-container-high" />
                  <div className="h-4 w-1/2 rounded bg-surface-container-high" />
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Modules */}
        <section
          className="border-t border-surface-border bg-surface px-4 py-16 sm:px-6 sm:py-20 lg:px-container-pad lg:py-24"
          id="modules"
        >
          <div className="mx-auto max-w-7xl">
            <Reveal className="mx-auto mb-10 max-w-3xl text-center sm:mb-16">
              <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-primary sm:text-sm">
                Une plateforme, un établissement
              </h2>
              <h3 className="mb-4 text-3xl font-extrabold tracking-tight text-text-primary sm:mb-6 sm:text-4xl md:text-5xl">
                Tout ce qu’une école gère, au même endroit
              </h3>
              <p className="text-base text-text-secondary sm:text-lg">
                Pas de tableur, pas de cahier papier, pas de logiciel isolé pour chaque service.
                ScolarGest couvre le parcours complet de l’élève et de l’établissement.
              </p>
            </Reveal>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
              {MODULES.map(({ icon: Icon, title, description }, i) => (
                <Reveal key={title} delayMs={(i % 4) * 80}>
                  <div className="group h-full rounded-xl border border-surface-border bg-surface-container-lowest p-6 shadow-subtle transition-all duration-300 hover:-translate-y-1 hover:border-primary-fixed-dim hover:shadow-lg">
                    <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 transition-colors duration-300 group-hover:bg-primary">
                      <Icon
                        className="h-6 w-6 text-primary transition-colors duration-300 group-hover:text-white"
                        aria-hidden
                      />
                    </div>
                    <h4 className="mb-2 text-lg font-bold text-text-primary">{title}</h4>
                    <p className="text-sm leading-relaxed text-text-secondary">{description}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Roles */}
        <section
          className="border-t border-surface-border bg-surface-container-low px-4 py-16 sm:px-6 sm:py-20 lg:px-container-pad lg:py-24"
          id="roles"
        >
          <div className="mx-auto max-w-7xl text-center">
            <Reveal>
              <h2 className="mb-4 text-2xl font-extrabold tracking-tight text-text-primary sm:mb-6 sm:text-3xl md:text-4xl">
                Un accès pensé pour chaque rôle
              </h2>
              <p className="mx-auto mb-10 max-w-2xl text-base text-text-secondary sm:mb-16 sm:text-lg">
                Pas de compte générique : chaque personne voit exactement ce dont elle a besoin
                pour son rôle, ni plus, ni moins.
              </p>
            </Reveal>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-8 lg:grid-cols-4">
              {ROLES.map(({ name, description }, i) => (
                <Reveal key={name} delayMs={i * 80}>
                  <div className="flex h-full flex-col items-center rounded-xl border border-surface-border bg-surface-container-lowest p-6 text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md sm:p-8">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-fixed sm:mb-6 sm:h-16 sm:w-16">
                      <Users className="h-6 w-6 text-primary sm:h-7 sm:w-7" aria-hidden />
                    </div>
                    <h4 className="mb-2 text-lg font-bold text-text-primary sm:mb-3 sm:text-xl">
                      {name}
                    </h4>
                    <p className="text-sm leading-relaxed text-text-secondary">{description}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Security */}
        <section
          className="border-t border-surface-border bg-surface-container-highest px-4 py-16 sm:px-6 sm:py-20 lg:px-container-pad lg:py-24"
          id="securite"
        >
          <div className="mx-auto max-w-7xl">
            <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
              <Reveal>
                <h2 className="mb-4 text-2xl font-extrabold tracking-tight text-text-primary sm:mb-6 sm:text-3xl md:text-4xl">
                  Les données d’une école ne se traitent pas à la légère
                </h2>
                <p className="mb-6 text-base leading-relaxed text-text-secondary sm:mb-8 sm:text-lg">
                  Élèves, notes, paiements : ce sont des données sensibles. ScolarGest applique
                  une isolation stricte et une traçabilité complète, dès la conception.
                </p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
                  {SECURITY_POINTS.map(({ icon: Icon, title, description }) => (
                    <div
                      key={title}
                      className="rounded-xl border border-surface-border bg-surface-container-lowest p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <Icon className="mb-3 h-7 w-7 text-primary" aria-hidden />
                      <h5 className="mb-1 font-bold text-text-primary">{title}</h5>
                      <p className="text-xs text-text-secondary">{description}</p>
                    </div>
                  ))}
                </div>
              </Reveal>
              <Reveal delayMs={150}>
                <div className="animate-float relative flex h-[300px] flex-col items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-primary-container p-6 text-center shadow-2xl sm:h-[400px] sm:p-8">
                  <div className="relative z-10 mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-white/20 bg-white/10 backdrop-blur-md sm:h-24 sm:w-24">
                    <ShieldCheck className="h-10 w-10 text-white sm:h-12 sm:w-12" aria-hidden />
                  </div>
                  <h3 className="relative z-10 mb-2 text-xl font-bold text-white sm:text-2xl">
                    Isolation par établissement
                  </h3>
                  <p className="relative z-10 max-w-sm text-sm text-primary-fixed-dim">
                    Appliquée directement au niveau de la base de données (Row Level Security),
                    pas seulement dans le code applicatif.
                  </p>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* CTA banner */}
        <section className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-primary-container px-4 py-16 sm:px-6 sm:py-20 lg:px-container-pad lg:py-24">
          <div className="pointer-events-none absolute right-0 top-0 h-[300px] w-[300px] rounded-full bg-white/5 blur-[60px] sm:h-[500px] sm:w-[500px] sm:blur-[80px]" />
          <Reveal className="relative z-10 mx-auto flex max-w-4xl flex-col items-center text-center">
            <h2 className="mb-4 text-3xl font-extrabold tracking-tight text-white sm:mb-6 sm:text-4xl md:text-5xl">
              Prêt à moderniser la gestion de votre école ?
            </h2>
            <p className="mb-8 max-w-2xl text-base text-primary-fixed-dim sm:mb-10 sm:text-lg">
              Chaque établissement est créé et configuré avec notre équipe — remplissez le
              formulaire ci-dessous pour une présentation adaptée à votre école.
            </p>
            <div className="flex w-full flex-col justify-center gap-3 sm:flex-row sm:gap-4">
              <Button
                size="lg"
                asChild
                className="h-12 w-full bg-white px-10 text-base font-bold text-primary transition-transform duration-300 hover:-translate-y-1 hover:bg-surface-container sm:h-14 sm:w-auto"
              >
                <a href="#demo">Demander une démo</a>
              </Button>
              <Button
                size="lg"
                variant="secondary"
                asChild
                className="h-12 w-full border-2 border-white/30 bg-transparent px-10 text-base font-bold text-white transition-transform duration-300 hover:-translate-y-1 hover:bg-white/10 sm:h-14 sm:w-auto"
              >
                <Link href="/login">Se connecter</Link>
              </Button>
            </div>
            <p className="mt-6 flex items-center gap-2 text-center text-sm text-white/60">
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden /> Aucun essai libre-service —
              chaque école est mise en place avec notre équipe.
            </p>
          </Reveal>
        </section>

        {/* Demo form */}
        <section
          className="border-t border-surface-border bg-surface px-4 py-16 sm:px-6 sm:py-20 lg:px-container-pad lg:py-24"
          id="demo"
        >
          <Reveal className="mx-auto max-w-2xl">
            <div className="mb-8 text-center sm:mb-10">
              <h2 className="mb-3 text-2xl font-extrabold tracking-tight text-text-primary sm:text-3xl md:text-4xl">
                Demander une démo
              </h2>
              <p className="text-base text-text-secondary sm:text-lg">
                Laissez-nous vos coordonnées, notre équipe vous recontacte pour organiser une
                présentation de ScolarGest adaptée à votre établissement.
              </p>
            </div>
            <div className="rounded-2xl border border-surface-border bg-surface-container-lowest p-5 shadow-subtle sm:p-8">
              <DemandeDemoForm />
            </div>
            <p className="mt-6 text-center text-sm text-text-secondary">
              Vous préférez écrire directement ?{' '}
              <a href="mailto:hartkit.dev@gmail.com" className="font-medium text-primary hover:underline">
                hartkit.dev@gmail.com
              </a>
            </p>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-surface-border bg-surface-container-low px-4 py-10 sm:px-6 sm:py-12 lg:px-container-pad">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-primary">
              <GraduationCap className="h-4 w-4 text-white" aria-hidden />
            </div>
            <span className="text-lg font-bold text-primary">ScolarGest</span>
          </div>
          <p className="text-xs text-text-secondary">
            © {new Date().getFullYear()} ScolarGest. Tous droits réservés.
          </p>
          <a
            href="mailto:hartkit.dev@gmail.com"
            className="text-xs text-text-secondary transition-colors hover:text-primary"
          >
            hartkit.dev@gmail.com
          </a>
        </div>
      </footer>
    </div>
  );
}

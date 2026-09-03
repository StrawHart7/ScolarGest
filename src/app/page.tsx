import Link from 'next/link';
import Image from 'next/image';
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
import { SectionTarifs } from '@/components/marketing/SectionTarifs';

const LIENS_NAV = [
  { href: '#modules', label: 'Fonctionnalités' },
  { href: '#securite', label: 'Sécurité' },
  { href: '#roles', label: 'Rôles' },
  { href: '#tarifs', label: 'Tarifs' },
];

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

const ETAPES_DEMO = [
  {
    titre: 'Vous nous laissez vos coordonnées',
    detail: 'Deux minutes, et rien à installer.',
  },
  {
    titre: 'Nous vous rappelons sous 48 heures',
    detail:
      'Pour comprendre votre organisation : cycles enseignés, effectifs, façon de facturer.',
  },
  {
    titre: 'Votre espace est ouvert et configuré',
    detail:
      'Vos classes, vos matières et vos frais sont en place. Vous disposez ensuite de 30 jours d’essai gratuit.',
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-on-surface antialiased">
      {/*
        Barre flottante en pilule : elle survole le hero au lieu de le couper par
        un bandeau plein. Elle reste `fixed` — le hero reserve la hauteur qu'il
        faut par son padding haut, plutot que le `pt-16` global d'avant, qui
        empechait toute section de remonter sous la barre.
      */}
      <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-6 sm:pt-5">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 rounded-full border border-white/70 bg-white/75 pl-3 pr-2 shadow-[0_8px_30px_rgba(9,30,66,0.10)] backdrop-blur-xl sm:h-16 sm:pl-5 sm:pr-3">
          <Link href="/" className="flex items-center gap-2 sm:gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary-container to-primary shadow-md">
              <GraduationCap className="h-5 w-5 text-white" aria-hidden />
            </div>
            <span className="text-lg font-bold tracking-tight text-text-primary sm:text-xl">
              Scolar<span className="font-semibold text-primary-container">Gest</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {LIENS_NAV.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                className="rounded-full px-3.5 py-2 text-sm font-medium text-text-secondary backdrop-blur-md transition-all duration-200 hover:bg-white/60 hover:text-primary-container hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_4px_16px_rgba(9,30,66,0.10)] hover:backdrop-blur-xl"
              >
                {label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-1 sm:gap-2">
            <Link
              href="/login"
              className="rounded-full px-3 py-2 text-xs font-medium text-text-secondary backdrop-blur-md transition-all duration-200 hover:bg-white/60 hover:text-primary-container hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_4px_16px_rgba(9,30,66,0.10)] hover:backdrop-blur-xl sm:text-sm"
            >
              Connexion
            </Link>
            <a
              href="#demo"
              className="inline-flex h-10 items-center justify-center rounded-full bg-primary-container px-4 text-xs font-semibold text-white shadow-[0_6px_16px_rgba(0,82,204,0.30)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary sm:h-11 sm:px-5 sm:text-sm"
            >
              <span className="sm:hidden">Démo</span>
              <span className="hidden sm:inline">Demander une démo</span>
            </a>
          </div>
        </div>
      </header>

      <main className="flex-grow">
        {/*
          Le hero tient dans une seule hauteur d'ecran, quel que soit le zoom.
          Deux choix y suffisent : `100svh` plutot que `100vh` (la barre d'URL
          mobile ne recadre plus le bas), et des tailles en `clamp(rem, vw, rem)`
          plutot qu'une echelle par paliers `sm:`/`lg:`. Un zoom navigateur
          reduit la largeur du viewport en pixels CSS : les `vw` suivent, donc la
          composition se contracte au lieu de deborder sous la ligne de flottaison.
          La capture est volontairement rognee en bas par `overflow-hidden` — elle
          se poursuit sous le pli, ce qui indique qu'il y a une suite.
        */}
        <section className="relative isolate flex min-h-svh flex-col overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(125%_95%_at_50%_-15%,#ffffff_32%,#e4ecff_62%,#bed3f7_100%)]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[55svh] bg-[radial-gradient(55%_100%_at_50%_0%,rgba(0,82,204,0.14),transparent_72%)]"
          />

          <div className="flex flex-1 flex-col items-center px-4 pb-0 pt-[clamp(5rem,12vh,7.5rem)] text-center sm:px-6">
            <div className="flex items-center gap-2 rounded-full border border-white/80 bg-white/80 px-3.5 py-1.5 shadow-[0_4px_14px_rgba(9,30,66,0.08)] backdrop-blur-sm">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-container opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary-container" />
              </span>
              <span className="text-[11px] font-medium text-text-secondary sm:text-xs">
                Conçu pour les écoles privées togolaises
              </span>
            </div>

            <h1 className="mt-[clamp(1rem,2.8vh,1.6rem)] max-w-3xl text-[clamp(1.75rem,4.9vw,3.4rem)] font-extrabold leading-[1.05] tracking-tight text-text-primary">
              La gestion scolaire,
              <span className="block font-serif text-[1.04em] font-normal italic text-primary-container">
                enfin unifiée.
              </span>
            </h1>

            <p className="mt-[clamp(0.8rem,2vh,1.2rem)] max-w-xl text-[clamp(0.85rem,0.95vw,1rem)] leading-relaxed text-text-secondary">
              Élèves, enseignants, notes, finances et documents officiels dans une seule
              plateforme sécurisée — de l’inscription jusqu’au bulletin.
            </p>

            <div className="mt-[clamp(1.2rem,2.8vh,1.8rem)] flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
              <a
                href="#demo"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary-container px-7 text-sm font-semibold text-white shadow-[0_10px_28px_rgba(0,82,204,0.32)] transition-all duration-300 hover:-translate-y-1 hover:bg-primary sm:w-auto"
              >
                Demander une démo
                <ArrowRight className="h-4 w-4" aria-hidden />
              </a>
              <Link
                href="/login"
                className="inline-flex h-11 w-full items-center justify-center rounded-full border border-surface-border bg-white px-7 text-sm font-semibold text-text-primary shadow-[0_4px_14px_rgba(9,30,66,0.08)] transition-all duration-300 hover:-translate-y-1 hover:border-primary-fixed-dim sm:w-auto"
              >
                Se connecter
              </Link>
            </div>

            <div className="mt-[clamp(1.6rem,4vh,2.8rem)] w-full max-w-6xl">
              <div className="relative mx-auto h-[clamp(150px,32svh,416px)] overflow-hidden rounded-t-2xl border border-white/90 bg-white shadow-[0_-2px_0_rgba(255,255,255,0.9),0_30px_70px_-20px_rgba(9,30,66,0.35)] sm:rounded-t-3xl">
                <Image
                  src="/assets/images/illustrations/Dashboard_hero.png"
                  alt="Tableau de bord ScolarGest : effectifs, remplissage, encaissements de l’année et bulletins générés."
                  width={1672}
                  height={941}
                  priority
                  sizes="(min-width: 1280px) 1152px, 100vw"
                  className="w-full"
                />
              </div>
            </div>
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

        {/* Tarifs */}
        <SectionTarifs />

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
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden /> Votre espace est mis en
              place avec notre équipe, puis 30 jours d’essai gratuit pour décider.
            </p>
          </Reveal>
        </section>

        {/* Demo form */}
        <section
          className="relative overflow-hidden border-t border-surface-border bg-surface px-4 py-16 sm:px-6 sm:py-20 lg:px-container-pad lg:py-24"
          id="demo"
        >
          {/* Halos repris du hero : la demande de démo est la fin du parcours,
              elle mérite le même traitement que son ouverture. */}
          <div className="pointer-events-none absolute left-0 top-0 h-[300px] w-[300px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-primary-fixed/40 blur-[90px] sm:h-[520px] sm:w-[520px]" />
          <div className="pointer-events-none absolute bottom-0 right-0 h-[260px] w-[260px] translate-x-1/3 translate-y-1/3 rounded-full bg-tertiary-fixed/25 blur-[80px] sm:h-[420px] sm:w-[420px]" />

          <div className="relative z-10 mx-auto grid max-w-6xl grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-16">
            <Reveal>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary-container">
                Démonstration
              </p>
              <h2 className="mb-4 text-2xl font-extrabold tracking-tight text-text-primary sm:mb-6 sm:text-3xl md:text-4xl">
                Voyez ScolarGest tourner sur votre propre école
              </h2>
              <p className="mb-8 text-base leading-relaxed text-text-secondary sm:mb-10 sm:text-lg">
                Une présentation d’une trentaine de minutes, avec vos classes, vos niveaux et vos
                frais. Pas une démo générique.
              </p>

              <ol className="flex flex-col gap-5">
                {ETAPES_DEMO.map((etape, i) => (
                  <li key={etape.titre} className="flex gap-4">
                    <span
                      aria-hidden
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white"
                    >
                      {i + 1}
                    </span>
                    <div>
                      <p className="font-semibold text-text-primary">{etape.titre}</p>
                      <p className="mt-0.5 text-sm leading-relaxed text-text-secondary">
                        {etape.detail}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>

              <div className="mt-8 flex flex-col gap-3 rounded-xl border border-surface-border bg-surface-container-lowest p-5 sm:mt-10">
                <p className="flex items-center gap-2.5 text-sm text-text-secondary">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-tertiary" aria-hidden />
                  Aucune carte bancaire demandée.
                </p>
                <p className="flex items-center gap-2.5 text-sm text-text-secondary">
                  <Lock className="h-4 w-4 shrink-0 text-tertiary" aria-hidden />
                  Vos coordonnées servent uniquement à vous recontacter.
                </p>
              </div>
            </Reveal>

            <Reveal delayMs={120}>
              <div className="rounded-2xl border border-surface-border bg-surface-container-lowest p-5 shadow-floating sm:p-8">
                <h3 className="mb-1 text-lg font-bold text-text-primary sm:text-xl">
                  Parlez-nous de votre établissement
                </h3>
                <p className="mb-6 text-sm text-text-secondary">
                  Les champs marqués d’une étoile sont nécessaires pour vous répondre.
                </p>
                <DemandeDemoForm />
              </div>
              <p className="mt-5 text-center text-sm text-text-secondary">
                Vous préférez écrire directement ?{' '}
                <a
                  href="mailto:hartkit.dev@gmail.com"
                  className="font-medium text-primary hover:underline"
                >
                  hartkit.dev@gmail.com
                </a>
              </p>
            </Reveal>
          </div>
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

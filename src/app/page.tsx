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
  Mail,
  MapPin,
  Briefcase,
  ClipboardList,
  Calculator,
  Layers,
  Lock,
  KeyRound,
  History,
  CheckCircle2,
} from 'lucide-react';
import { Reveal } from '@/components/motion/Reveal';
import { DemandeDemoForm } from '@/components/marketing/DemandeDemoForm';
import { SectionTarifs } from '@/components/marketing/SectionTarifs';
import { getPlacesFondatrices } from '@/services/plateforme';

const LIENS_NAV = [
  { href: '#modules', label: 'Fonctionnalités' },
  { href: '#securite', label: 'Sécurité' },
  { href: '#roles', label: 'Rôles' },
  { href: '#tarifs', label: 'Tarifs' },
];

const LIENS_PIED = [
  {
    titre: 'Produit',
    liens: [
      { href: '#modules', label: 'Fonctionnalités', externe: true },
      { href: '#securite', label: 'Sécurité', externe: true },
      { href: '#roles', label: 'Rôles', externe: true },
      { href: '#tarifs', label: 'Tarifs', externe: true },
    ],
  },
  {
    titre: 'Commencer',
    liens: [
      { href: '#demo', label: 'Demander une démo', externe: true },
      { href: '/login', label: 'Se connecter', externe: false },
      { href: '/login', label: 'Mot de passe oublié', externe: false },
    ],
  },
  {
    titre: 'Assistance',
    liens: [
      { href: 'mailto:hartkit.dev@gmail.com', label: 'Nous écrire', externe: true },
      {
        href: 'mailto:hartkit.dev@gmail.com?subject=Support%20ScolarGest',
        label: 'Support technique',
        externe: true,
      },
    ],
  },
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
  {
    icon: Briefcase,
    name: 'Directeur',
    description: 'Vue d’ensemble de l’établissement, validation des décisions clés.',
  },
  {
    icon: ClipboardList,
    name: 'Secrétaire',
    description: 'Inscriptions, dossiers élèves, gestion administrative au quotidien.',
  },
  {
    icon: Calculator,
    name: 'Comptable',
    description: 'Facturation, paiements, suivi financier de l’établissement.',
  },
  {
    icon: BookOpenCheck,
    name: 'Enseignant',
    description: 'Saisie des notes et suivi de ses classes et matières affectées.',
  },
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
      'Vos classes, vos matières et vos frais sont en place, et vos équipes formées. Vous démarrez sur une école déjà prête.',
  },
];

/*
 * Revalidation toutes les cinq minutes.
 *
 * La page lit le nombre de places fondatrices restantes, donc la base. Sans
 * cette borne, chaque visiteur d'une page purement commerciale declencherait
 * une requete ; avec elle, le compteur reste juste a quelques minutes pres —
 * une precision largement suffisante pour un programme qui admet une ecole par
 * semaine au mieux.
 */
export const revalidate = 300;

export default async function LandingPage() {
  // Ne doit jamais empecher la page d'accueil de s'afficher : sans compteur,
  // l'offre reste lisible ; sans page, il n'y a plus de site.
  let places = { prises: 0, max: null as number | null };
  try {
    places = await getPlacesFondatrices();
  } catch {
    /* compteur muet plutot que page en erreur */
  }

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-on-surface antialiased">
      {/*
        Barre flottante en pilule : elle survole le hero au lieu de le couper par
        un bandeau plein. Elle reste `fixed` — le hero reserve la hauteur qu'il
        faut par son padding haut, plutot que le `pt-16` global d'avant, qui
        empechait toute section de remonter sous la barre.

        Le fond de la pilule est volontairement peu opaque (`bg-white/55`) : a
        `bg-white/75`, le survol en verre des liens ne se distinguait plus du
        fond de la barre elle-meme, et l'effet passait pour inexistant.
      */}
      <header className="fixed inset-x-0 top-0 z-50 px-2.5 pt-2.5 sm:px-5 sm:pt-4">
        <div className="mx-auto flex h-11 w-full max-w-[51rem] items-center justify-between gap-3 rounded-full border border-white/70 bg-white/55 pl-2.5 pr-1.5 shadow-[0_8px_30px_rgba(9,30,66,0.10)] backdrop-blur-xl sm:h-[3.25rem] sm:pl-4 sm:pr-2">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary-container to-primary shadow-md">
              <GraduationCap className="h-4 w-4 text-white" aria-hidden />
            </div>
            <span className="text-[0.9rem] font-bold tracking-tight text-text-primary sm:text-base">
              Scolar<span className="font-semibold text-primary-container">Gest</span>
            </span>
          </Link>

          {/*
            Survol en verre : fond degrade blanc -> bleu clair, liseret interieur
            lumineux et ombre portee courte. Un simple changement de couleur de
            texte, ou un `bg-white/60` pose sur une barre deja blanche, ne se
            voyait pas — c'est le contraste bleute qui rend l'effet lisible.
          */}
          <nav className="hidden items-center gap-0.5 lg:flex">
            {LIENS_NAV.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                className="rounded-full px-3 py-1.5 text-xs font-medium text-text-secondary transition-all duration-200 hover:bg-gradient-to-b hover:from-white/95 hover:to-primary-fixed/70 hover:text-primary-container hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_4px_14px_rgba(0,61,155,0.16)] hover:ring-1 hover:ring-white/80"
              >
                {label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-1">
            <Link
              href="/login"
              className="rounded-full px-2.5 py-1.5 text-[0.7rem] font-medium text-text-secondary transition-all duration-200 hover:bg-gradient-to-b hover:from-white/95 hover:to-primary-fixed/70 hover:text-primary-container hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_4px_14px_rgba(0,61,155,0.16)] hover:ring-1 hover:ring-white/80 sm:text-xs"
            >
              Connexion
            </Link>
            <a
              href="#demo"
              className="inline-flex h-8 items-center justify-center rounded-full bg-primary-container px-3 text-[0.7rem] font-semibold text-white shadow-[0_6px_16px_rgba(0,82,204,0.30)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary sm:h-9 sm:px-4 sm:text-xs"
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
          plutot qu'une echelle par paliers `sm:`/`lg:`.

          Toutes les mesures — y compris les largeurs maximales des conteneurs et
          les coefficients `vw`/`vh` — valent 80% du premier jet : a 100% de zoom
          la composition etait trop genereuse, et c'est le rendu a 80% qui avait
          la bonne densite. Reduire seulement la typographie n'aurait pas suffi,
          les conteneurs seraient restes a leur echelle.

          La capture occupe l'espace restant (`flex-1` + `min-h-0` implicite par
          `min-h-[8rem]`) au lieu d'une hauteur fixe : une hauteur en `clamp()`
          laissait un vide entre le bas du cadre et le bas de l'ecran des que le
          viewport etait plus haut que prevu. L'image elle-meme est en
          `h-full object-cover object-top`, donc elle remplit toujours le cadre
          et se poursuit sous le pli, sans jamais laisser de bande vide.
        */}
        <section className="relative isolate flex min-h-svh flex-col overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(125%_95%_at_50%_-15%,#ffffff_32%,#e4ecff_62%,#bed3f7_100%)]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[44svh] bg-[radial-gradient(55%_100%_at_50%_0%,rgba(0,82,204,0.14),transparent_72%)]"
          />

          <div className="flex flex-1 flex-col items-center px-4 pt-[clamp(4.8rem,12vh,7.6rem)] text-center sm:px-6">
            <div className="flex items-center gap-2 rounded-full border border-white/80 bg-white/80 px-3 py-1 shadow-[0_4px_14px_rgba(9,30,66,0.08)] backdrop-blur-sm">
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-container opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary-container" />
              </span>
              <span className="text-[10px] font-medium text-text-secondary">
                Conçu pour les écoles privées togolaises
              </span>
            </div>

            <h1 className="mt-[clamp(1rem,2.8vh,1.6rem)] max-w-[51rem] text-[clamp(1.7rem,4.96vw,3.4rem)] font-extrabold leading-[1.05] tracking-tight text-text-primary">
              La gestion scolaire,
              <span className="block font-serif text-[1.04em] font-normal italic text-primary-container">
                enfin unifiée.
              </span>
            </h1>

            <p className="mt-[clamp(0.8rem,2vh,1.2rem)] max-w-[29rem] text-[clamp(0.76rem,0.92vw,0.9rem)] leading-relaxed text-text-secondary">
              Élèves, enseignants, notes, finances et documents officiels dans une seule
              plateforme sécurisée — de l’inscription jusqu’au bulletin.
            </p>

            <div className="mt-[clamp(1.2rem,2.8vh,1.8rem)] flex w-full flex-col items-center gap-2.5 sm:w-auto sm:flex-row">
              <a
                href="#demo"
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-primary-container px-6 text-xs font-semibold text-white shadow-[0_10px_28px_rgba(0,82,204,0.32)] transition-all duration-300 hover:-translate-y-1 hover:bg-primary sm:w-auto"
              >
                Demander une démo
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </a>
              <Link
                href="/login"
                className="inline-flex h-10 w-full items-center justify-center rounded-full border border-surface-border bg-white px-6 text-xs font-semibold text-text-primary shadow-[0_4px_14px_rgba(9,30,66,0.08)] transition-all duration-300 hover:-translate-y-1 hover:border-primary-fixed-dim sm:w-auto"
              >
                Se connecter
              </Link>
            </div>

            <div className="mt-[clamp(1.6rem,4vh,2.8rem)] flex min-h-[8rem] w-full max-w-[57.5rem] flex-1">
              <div className="relative h-full w-full overflow-hidden rounded-t-xl border border-white/90 bg-white shadow-[0_-2px_0_rgba(255,255,255,0.9),0_30px_70px_-20px_rgba(9,30,66,0.35)] sm:rounded-t-2xl">
                <Image
                  src="/assets/images/illustrations/Dashboard_hero.png"
                  alt="Tableau de bord ScolarGest : effectifs, remplissage, encaissements de l’année et bulletins générés."
                  width={1672}
                  height={941}
                  priority
                  sizes="(min-width: 960px) 920px, 100vw"
                  className="h-full w-full object-cover object-top"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Modules */}
        <section
          className="relative border-t border-surface-border bg-surface px-4 py-16 sm:px-6 sm:py-20 lg:px-container-pad lg:py-24"
          id="modules"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-primary-fixed/25 to-transparent"
          />
          <div className="relative mx-auto max-w-7xl">
            <Reveal className="mx-auto mb-10 max-w-3xl text-center sm:mb-16">
              <span className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-surface-border bg-surface-container-lowest px-3 py-1 shadow-subtle">
                <span className="relative flex h-1.5 w-1.5 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-container opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary-container" />
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-primary-container">
                  Une plateforme, un établissement
                </span>
              </span>
              <h2 className="mb-4 text-3xl font-extrabold tracking-tight text-text-primary sm:mb-6 sm:text-4xl md:text-5xl">
                Tout ce qu’une école gère, au même endroit
              </h2>
              <p className="text-base text-text-secondary sm:text-lg">
                Pas de tableur, pas de cahier papier, pas de logiciel isolé pour chaque service.
                ScolarGest couvre le parcours complet de l’élève et de l’établissement.
              </p>
            </Reveal>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
              {MODULES.map(({ icon: Icon, title, description }, i) => (
                <Reveal key={title} delayMs={(i % 4) * 70}>
                  {/*
                    Tout est en transition CSS declenchee par `group-hover` et en
                    apparition au scroll via `Reveal` (IntersectionObserver) :
                    aucune bibliotheque d'animation n'est chargee pour la page
                    publique, qui est justement celle qu'on veut la plus legere.
                  */}
                  <div className="group relative h-full overflow-hidden rounded-2xl border border-surface-border bg-surface-container-lowest p-6 shadow-subtle transition-all duration-300 hover:-translate-y-1.5 hover:border-primary-fixed-dim hover:shadow-[0_18px_40px_-18px_rgba(9,30,66,0.35)]">
                    {/* Filet d'accent qui se deroule depuis la gauche au survol. */}
                    <span
                      aria-hidden
                      className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-gradient-to-r from-primary-container to-surface-tint transition-transform duration-500 ease-out group-hover:scale-x-100"
                    />
                    <span
                      aria-hidden
                      className="pointer-events-none absolute -right-16 -top-16 h-32 w-32 rounded-full bg-primary-fixed/50 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
                    />
                    <div className="relative mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary-fixed to-primary-fixed/40 transition-all duration-300 group-hover:-rotate-6 group-hover:scale-110 group-hover:from-primary-container group-hover:to-primary">
                      <Icon
                        className="h-6 w-6 text-primary-container transition-colors duration-300 group-hover:text-white"
                        aria-hidden
                      />
                    </div>
                    <h3 className="relative mb-2 text-lg font-bold text-text-primary transition-colors duration-300 group-hover:text-primary-container">
                      {title}
                    </h3>
                    <p className="relative text-sm leading-relaxed text-text-secondary">
                      {description}
                    </p>
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
              {ROLES.map(({ icon: Icon, name, description }, i) => (
                <Reveal key={name} delayMs={i * 70}>
                  <div className="group relative flex h-full flex-col items-center overflow-hidden rounded-2xl border border-surface-border bg-surface-container-lowest p-6 text-center shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-primary-fixed-dim hover:shadow-[0_18px_40px_-18px_rgba(9,30,66,0.35)] sm:p-8">
                    <span
                      aria-hidden
                      className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-gradient-to-r from-primary-container to-surface-tint transition-transform duration-500 ease-out group-hover:scale-x-100"
                    />
                    <div className="relative mb-4 flex h-14 w-14 items-center justify-center sm:mb-6 sm:h-16 sm:w-16">
                      {/* Halo qui bat au survol seulement : une pulsation permanente
                          sur quatre cartes a la fois deviendrait du bruit. */}
                      <span
                        aria-hidden
                        className="absolute inset-0 rounded-full bg-primary-fixed-dim opacity-0 transition-opacity duration-300 group-hover:animate-ring-pulse group-hover:opacity-100"
                      />
                      <span className="relative flex h-full w-full items-center justify-center rounded-full bg-primary-fixed transition-transform duration-300 group-hover:scale-105">
                        <Icon
                          className="h-6 w-6 text-primary-container transition-transform duration-300 group-hover:scale-110 sm:h-7 sm:w-7"
                          aria-hidden
                        />
                      </span>
                    </div>
                    <h3 className="mb-2 text-lg font-bold text-text-primary transition-colors duration-300 group-hover:text-primary-container sm:mb-3 sm:text-xl">
                      {name}
                    </h3>
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
                      className="group relative h-full overflow-hidden rounded-2xl border border-surface-border bg-surface-container-lowest p-5 transition-all duration-300 hover:-translate-y-1 hover:border-primary-fixed-dim hover:shadow-[0_16px_34px_-18px_rgba(9,30,66,0.35)]"
                    >
                      <span
                        aria-hidden
                        className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-gradient-to-r from-primary-container to-surface-tint transition-transform duration-500 ease-out group-hover:scale-x-100"
                      />
                      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary-fixed to-primary-fixed/40 transition-all duration-300 group-hover:-rotate-6 group-hover:scale-110 group-hover:from-primary-container group-hover:to-primary">
                        <Icon
                          className="h-5 w-5 text-primary-container transition-colors duration-300 group-hover:text-white"
                          aria-hidden
                        />
                      </div>
                      <h3 className="mb-1 font-bold text-text-primary transition-colors duration-300 group-hover:text-primary-container">
                        {title}
                      </h3>
                      <p className="text-xs leading-relaxed text-text-secondary">{description}</p>
                    </div>
                  ))}
                </div>
              </Reveal>
              <Reveal delayMs={150}>
                {/*
                  Le panneau etait un aplat bleu de 400px avec beaucoup de vide.
                  Trois ajouts le remplissent sans le charger : des cercles
                  concentriques qui donnent une profondeur, un halo qui bat
                  lentement derriere l'icone, et les trois garanties reprises en
                  pastilles — le panneau dit desormais quelque chose de precis.
                */}
                <div className="animate-float relative flex h-[320px] flex-col items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-primary-container p-6 text-center shadow-2xl sm:h-[420px] sm:p-8">
                  <span
                    aria-hidden
                    className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10"
                  />
                  <span
                    aria-hidden
                    className="pointer-events-none absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10"
                  />
                  <span
                    aria-hidden
                    className="pointer-events-none absolute left-1/2 top-1/2 h-[180px] w-[180px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10"
                  />
                  <span
                    aria-hidden
                    className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10 blur-3xl"
                  />

                  <div className="relative z-10 mb-6 flex h-20 w-20 items-center justify-center sm:h-24 sm:w-24">
                    <span
                      aria-hidden
                      className="animate-ring-pulse absolute inset-0 rounded-2xl bg-white/20"
                    />
                    <span className="relative flex h-full w-full items-center justify-center rounded-2xl border border-white/20 bg-white/10 backdrop-blur-md">
                      <ShieldCheck className="h-10 w-10 text-white sm:h-12 sm:w-12" aria-hidden />
                    </span>
                  </div>
                  <h3 className="relative z-10 mb-2 text-xl font-bold text-white sm:text-2xl">
                    Isolation par établissement
                  </h3>
                  <p className="relative z-10 max-w-sm text-sm leading-relaxed text-primary-fixed-dim">
                    Appliquée directement au niveau de la base de données (Row Level Security),
                    pas seulement dans le code applicatif.
                  </p>
                  <ul className="relative z-10 mt-6 flex flex-wrap items-center justify-center gap-2">
                    {['Row Level Security', 'PIN d’approbation', 'Journal d’audit'].map(
                      (garantie) => (
                        <li
                          key={garantie}
                          className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-medium text-white backdrop-blur-sm"
                        >
                          {garantie}
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* Tarifs */}
        <SectionTarifs places={places} />

        {/* CTA banner */}
        <section className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-primary-container px-4 py-16 sm:px-6 sm:py-20 lg:px-container-pad lg:py-24">
          <div className="pointer-events-none absolute right-0 top-0 h-[300px] w-[300px] rounded-full bg-white/5 blur-[60px] sm:h-[500px] sm:w-[500px] sm:blur-[80px]" />
          <div className="pointer-events-none absolute -bottom-24 left-0 h-[260px] w-[260px] rounded-full bg-surface-tint/20 blur-[70px] sm:h-[420px] sm:w-[420px]" />
          <Reveal className="relative z-10 mx-auto flex max-w-4xl flex-col items-center text-center">
            <h2 className="mb-4 text-3xl font-extrabold tracking-tight text-white sm:mb-6 sm:text-4xl md:text-5xl">
              Prêt à moderniser la gestion de votre école ?
            </h2>
            <p className="mb-8 max-w-2xl text-base text-primary-fixed-dim sm:mb-10 sm:text-lg">
              Chaque établissement est créé et configuré avec notre équipe — remplissez le
              formulaire ci-dessous pour une présentation adaptée à votre école.
            </p>
            {/*
              Ancres nues plutot que `Button` : le variant `primary` force
              `!text-white` y compris sur l'enfant slotte, donc un bouton a fond
              blanc affichait un libelle blanc sur blanc — invisible. C'est le
              meme piege que celui documente dans `button.tsx`, pris a l'envers.
            */}
            <div className="flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row sm:gap-4">
              <a
                href="#demo"
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white px-8 text-sm font-bold text-primary-container shadow-[0_12px_30px_rgba(0,24,72,0.35)] transition-all duration-300 hover:-translate-y-1 hover:bg-primary-fixed sm:h-14 sm:w-auto sm:px-10 sm:text-base"
              >
                Demander une démo
                <ArrowRight className="h-4 w-4" aria-hidden />
              </a>
              <Link
                href="/login"
                className="inline-flex h-12 w-full items-center justify-center rounded-full border-2 border-white/35 px-8 text-sm font-bold text-white transition-all duration-300 hover:-translate-y-1 hover:border-white/70 hover:bg-white/10 sm:h-14 sm:w-auto sm:px-10 sm:text-base"
              >
                Se connecter
              </Link>
            </div>
            <p className="mt-6 flex items-center gap-2 text-center text-sm text-white/60">
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden /> Votre espace est mis en
              place avec notre équipe, et vos équipes formées avant la première saisie.
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

      {/*
        Pied de page en carte flottante (modele fourni par l'utilisateur) :
        marque et signature a gauche, colonnes de liens a droite, filet de
        separation, ligne basse pour la mention legale.

        Aucune destination inventee. Le depot ne contient ni page de mentions
        legales, ni page de confidentialite, ni compte social : y renvoyer
        donnerait des liens morts, ce qui est pire qu'une colonne plus courte.
        `LIENS_PIED` ne contient donc que des ancres et des routes qui existent
        reellement — c'est aussi le seul endroit a modifier le jour ou ces
        pages seront ecrites.
      */}
      <footer className="bg-surface px-4 pb-8 sm:px-6 lg:px-container-pad">
        <div className="mx-auto max-w-7xl rounded-3xl border border-surface-border bg-surface-container-lowest px-6 py-10 shadow-subtle sm:px-10 sm:py-12">
          <div className="grid gap-10 md:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))] md:gap-8">
            <div className="max-w-sm">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary-container to-primary shadow-md">
                  <GraduationCap className="h-4 w-4 text-white" aria-hidden />
                </div>
                <span className="text-lg font-bold tracking-tight text-text-primary">
                  Scolar<span className="font-semibold text-primary-container">Gest</span>
                </span>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-text-secondary">
                La plateforme de gestion des écoles privées togolaises : élèves, notes,
                finances et documents officiels, réunis et sécurisés.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <a
                  href="mailto:hartkit.dev@gmail.com"
                  className="inline-flex items-center gap-2 rounded-full border border-surface-border bg-surface-container-low px-3 py-1.5 text-xs font-medium text-text-secondary transition-all duration-200 hover:-translate-y-0.5 hover:border-primary-fixed-dim hover:text-primary-container"
                >
                  <Mail className="h-3.5 w-3.5" aria-hidden />
                  hartkit.dev@gmail.com
                </a>
                <span className="inline-flex items-center gap-2 rounded-full border border-surface-border bg-surface-container-low px-3 py-1.5 text-xs font-medium text-text-secondary">
                  <MapPin className="h-3.5 w-3.5" aria-hidden />
                  Lomé, Togo
                </span>
              </div>
            </div>

            {LIENS_PIED.map(({ titre, liens }) => (
              <nav key={titre} aria-label={titre}>
                <h2 className="mb-4 text-sm font-bold text-text-primary">{titre}</h2>
                <ul className="flex flex-col gap-3">
                  {liens.map(({ href, label, externe }) => (
                    <li key={label}>
                      {externe ? (
                        <a
                          href={href}
                          className="text-sm text-text-secondary transition-colors duration-200 hover:text-primary-container"
                        >
                          {label}
                        </a>
                      ) : (
                        <Link
                          href={href}
                          className="text-sm text-text-secondary transition-colors duration-200 hover:text-primary-container"
                        >
                          {label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>

          <div className="mt-10 flex flex-col items-center gap-3 border-t border-surface-border pt-6 sm:flex-row sm:justify-between">
            <p className="text-xs text-text-secondary">
              © {new Date().getFullYear()} ScolarGest. Tous droits réservés.
            </p>
            <p className="text-xs text-text-secondary">
              Hébergé et isolé par établissement — vos données ne quittent jamais votre école.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

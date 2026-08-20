import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Receipt,
  School,
  UserPlus,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { StatsFinance } from '@/services/dashboard';

const fcfa = (montant: number) => `${Number(montant).toLocaleString('fr-FR')} F`;
const nombre = (valeur: number) => valeur.toLocaleString('fr-FR');

/**
 * Recouvrement en anneau plutôt qu'en barre de progression : la carte occupait
 * une demi-largeur d'écran pour une seule valeur. L'anneau porte le taux, et
 * l'espace libéré affiche la décomposition encaissé / restant, qui est
 * l'information réellement utile.
 */
export function TauxRecouvrement({ finance }: { finance: StatsFinance }) {
  const taux =
    finance.attendu > 0 ? Math.round((finance.encaisse / finance.attendu) * 100) : 0;
  // Anneau SVG : circonférence d'un cercle de rayon 42.
  const circonference = 2 * Math.PI * 42;
  const rempli = (Math.min(100, Math.max(0, taux)) / 100) * circonference;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recouvrement</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-6">
        <div className="relative h-28 w-28 shrink-0">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden>
            <circle cx="50" cy="50" r="42" fill="none" strokeWidth="10" className="stroke-surface-container" />
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${rempli} ${circonference}`}
              className="stroke-tertiary-container"
            />
          </svg>
          <div
            className="absolute inset-0 grid place-items-center"
            role="img"
            aria-label={`Taux de recouvrement : ${taux} %`}
          >
            <span className="text-headline-md text-text-primary" data-mono>
              {taux} %
            </span>
          </div>
        </div>

        <dl className="min-w-0 flex-1 space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-body-sm text-text-secondary">Encaissé</dt>
            <dd className="text-body-md font-semibold text-tertiary" data-mono>
              {fcfa(finance.encaisse)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-body-sm text-text-secondary">Reste à recouvrer</dt>
            <dd className="text-body-md font-semibold text-error" data-mono>
              {fcfa(finance.impaye)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 border-t border-surface-border pt-2">
            <dt className="text-body-sm text-text-secondary">Factures soldées</dt>
            <dd className="text-body-md text-text-primary" data-mono>
              {nombre(finance.facturesSoldees)} / {nombre(finance.facturesTotal)}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

export interface Raccourci {
  libelle: string;
  description: string;
  href: string;
  icone: LucideIcon;
}

export const RACCOURCIS: Record<string, Raccourci> = {
  inscrireEleve: {
    libelle: 'Inscrire un élève',
    description: 'Créer une fiche élève et ses responsables légaux.',
    href: '/etablissement/eleves/nouvelle',
    icone: UserPlus,
  },
  approbation: {
    libelle: 'Approbation des notes',
    description: 'Traiter les demandes de correction en attente.',
    href: '/etablissement/notes/approbation',
    icone: ClipboardCheck,
  },
  bulletins: {
    libelle: 'Génération de bulletins',
    description: 'Éditer les bulletins de la période en cours.',
    href: '/etablissement/notes/bulletins',
    icone: FileText,
  },
  suiviPaiements: {
    libelle: 'Suivi des paiements',
    description: 'Soldes par élève et relances à faire.',
    href: '/etablissement/finances/factures',
    icone: Receipt,
  },
  versements: {
    libelle: 'Historique des versements',
    description: 'Encaissements de l’année et reçus édités.',
    href: '/etablissement/finances/paiements',
    icone: Wallet,
  },
  rapports: {
    libelle: 'Rapports et exports',
    description: 'Excel, CSV ou PDF pour tout tableau affiché.',
    href: '/rapports',
    icone: FileText,
  },
  mesClasses: {
    libelle: 'Mes classes',
    description: 'Classes et matières qui vous sont affectées.',
    href: '/etablissement/mes-classes',
    icone: School,
  },
  saisieNotes: {
    libelle: 'Saisie des notes',
    description: 'Saisir puis soumettre les notes de vos évaluations.',
    href: '/etablissement/notes/saisie',
    icone: BookOpen,
  },
  eleves: {
    libelle: 'Liste des élèves',
    description: 'Rechercher un élève et ouvrir sa fiche.',
    href: '/etablissement/eleves',
    icone: GraduationCap,
  },
};

/** Raccourcis en blocs cliquables plutôt qu'en liste de liens texte. */
export function Raccourcis({ raccourcis }: { raccourcis: Raccourci[] }) {
  return (
    <section>
      <h2 className="mb-3 text-headline-sm text-text-primary">Raccourcis</h2>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {raccourcis.map((raccourci) => {
          const Icone = raccourci.icone;
          return (
            <li key={raccourci.href}>
              <Link
                href={raccourci.href}
                className="group flex h-full items-start gap-3 rounded-lg border border-surface-border bg-surface-container-lowest p-4 transition-all hover:-translate-y-0.5 hover:border-primary-container/60 hover:shadow-floating"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary-fixed text-primary-container transition-colors group-hover:bg-primary-container group-hover:text-white">
                  <Icone className="h-[18px] w-[18px]" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-body-md font-medium text-text-primary">
                    {raccourci.libelle}
                  </span>
                  <span className="block text-body-sm text-text-secondary">
                    {raccourci.description}
                  </span>
                </span>
                <ArrowRight
                  className="mt-1 h-4 w-4 shrink-0 text-text-secondary transition-transform group-hover:translate-x-0.5 group-hover:text-primary-container"
                  aria-hidden
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const ICONE_MODULE: Record<string, LucideIcon> = {
  eleves: GraduationCap,
  academique: BookOpen,
  finance: Wallet,
  finances: Wallet,
  structure: School,
  documents: FileText,
  utilisateurs: UserPlus,
};

const TEINTE_MODULE: Record<string, string> = {
  eleves: 'bg-primary-fixed text-primary-container',
  academique: 'bg-secondary-container text-secondary-on-container',
  finance: 'bg-tertiary-fixed text-tertiary-on-fixed-variant',
  finances: 'bg-tertiary-fixed text-tertiary-on-fixed-variant',
  structure: 'bg-surface-container-high text-text-secondary',
  documents: 'bg-surface-container-high text-text-secondary',
  utilisateurs: 'bg-primary-fixed text-primary-container',
};

/** « il y a 3 h » plutôt qu'un horodatage brut, plus lisible dans un flux. */
function tempsRelatif(date: string): string {
  const millisecondes = Date.now() - new Date(date).getTime();
  const minutes = Math.round(millisecondes / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const heures = Math.round(minutes / 60);
  if (heures < 24) return `il y a ${heures} h`;
  const jours = Math.round(heures / 24);
  if (jours < 31) return `il y a ${jours} j`;
  return new Date(date).toLocaleDateString('fr-FR');
}

export interface EvenementAffiche {
  id: string;
  libelle: string;
  module: string;
  date: string;
}

/**
 * Flux d'activité : une pastille colorée par module et un temps relatif, au
 * lieu d'une liste d'horodatages identiques qu'on ne parcourait pas.
 */
export function FluxActivite({ evenements }: { evenements: EvenementAffiche[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Activité récente</CardTitle>
      </CardHeader>
      <CardContent>
        {evenements.length === 0 ? (
          <p className="py-6 text-center text-body-sm text-text-secondary">
            Aucune activité enregistrée pour le moment.
          </p>
        ) : (
          <ol className="relative space-y-4 before:absolute before:bottom-3 before:left-[15px] before:top-3 before:w-px before:bg-surface-border">
            {evenements.map((evenement) => {
              const Icone = ICONE_MODULE[evenement.module] ?? FileText;
              return (
                <li key={evenement.id} className="relative flex items-start gap-3">
                  <span
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ring-4 ring-surface-container-lowest ${
                      TEINTE_MODULE[evenement.module] ?? 'bg-surface-container-high text-text-secondary'
                    }`}
                  >
                    <Icone className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-body-sm text-text-primary">{evenement.libelle}</p>
                    <p className="text-label-md text-text-secondary">
                      {tempsRelatif(evenement.date)} · {evenement.module}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

import * as React from 'react';
import Link from 'next/link';
import { ChevronRight, User, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Motif de liste mobile de référence (voir `Docs/15-Motif-liste-mobile.md`).
 *
 * Sous `md`, un `<Table>` ne tient pas : le scroll horizontal fait sortir de
 * l'écran les colonnes de droite, dont les actions. Chaque ligne devient une
 * rangée dense — avatar, titre, référence et contexte, statut et chevron —
 * dans une carte unique bordée. Le tableau reste inchangé à partir de `md`.
 *
 * Densité assumée : 48px par rangée (8px + 32px + 8px), ce qui reste au-delà
 * de la cible tactile de 44px du design system tout en montrant huit élèves
 * sans défiler.
 */
export function CarteListeMobile({ className, ...props }: React.HTMLAttributes<HTMLUListElement>) {
  return (
    <ul
      className={cn(
        'flex flex-col overflow-hidden rounded-xl border border-surface-border bg-surface-container-lowest shadow-sm md:hidden',
        className,
      )}
      {...props}
    />
  );
}

/** Tons de statut, alignés sur les rôles sémantiques du design system. */
const TONS_STATUT = {
  succes: 'bg-tertiary-container text-white',
  erreur: 'bg-error-container text-error-on-container',
  alerte: 'bg-warning/10 text-warning-on-container',
  info: 'bg-secondary-container text-primary',
  neutre: 'bg-surface-variant text-on-surface-variant',
} as const;

export type TonStatut = keyof typeof TONS_STATUT;

export interface StatutLigne {
  libelle: string;
  ton: TonStatut;
}

export interface LigneCarteMobileProps {
  titre: React.ReactNode;
  /** Contexte court affiché sous le titre (classe, période, mode de paiement…). */
  sousTitre?: React.ReactNode;
  /** Identifiant lisible (matricule, référence), rendu en chasse fixe. */
  reference?: React.ReactNode;
  href?: string;
  /** Icône dans la pastille de tête, `User` par défaut. */
  icone?: LucideIcon;
  /** Statut rendu en pastille compacte, en haut à droite. */
  statut?: StatutLigne;
  /** Valeur alignée à droite (montant, effectif) quand il n'y a pas de statut. */
  valeurSecondaire?: React.ReactNode;
  /**
   * Actions inline pour une rangée de configuration qui ne mène à aucune
   * fiche — incompatible avec `href` : une rangée est soit un lien de
   * navigation avec chevron, soit porteuse de ses propres boutons, jamais
   * les deux (un bouton dans un lien superpose deux cibles de tap).
   */
  actions?: React.ReactNode;
}

export function LigneCarteMobile({
  titre,
  sousTitre,
  reference,
  href,
  icone: Icone = User,
  statut,
  valeurSecondaire,
  actions,
}: LigneCarteMobileProps) {
  const ligne = (
    <div className="flex items-center gap-3 p-2">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-surface-border bg-surface-container text-secondary">
        <Icone className="h-5 w-5" aria-hidden />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-body-md font-bold text-text-primary">{titre}</p>
        {(reference || sousTitre) && (
          <div className="flex items-center gap-2">
            {reference && (
              <span className="shrink-0 font-mono text-[10px] text-secondary">{reference}</span>
            )}
            {reference && sousTitre && (
              <span className="h-1 w-1 shrink-0 rounded-full bg-outline-variant" aria-hidden />
            )}
            {sousTitre && (
              <span className="truncate text-[11px] text-on-surface-variant">{sousTitre}</span>
            )}
          </div>
        )}
      </div>

      {(statut || valeurSecondaire || href) && (
        <div className="flex shrink-0 flex-col items-end gap-1">
          {statut && (
            <span
              className={cn(
                'rounded-full px-1.5 text-[10px] font-bold leading-4',
                TONS_STATUT[statut.ton],
              )}
            >
              {statut.libelle}
            </span>
          )}
          {valeurSecondaire && (
            <span className="font-mono text-[11px] font-medium text-text-primary">
              {valeurSecondaire}
            </span>
          )}
          {href && <ChevronRight className="h-4 w-4 text-outline" aria-hidden />}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <li className="border-b border-surface-border last:border-b-0">
        <Link
          href={href}
          className="block transition-colors hover:bg-surface-container-low active:bg-surface-container-high"
        >
          {ligne}
        </Link>
      </li>
    );
  }

  return (
    <li className="border-b border-surface-border last:border-b-0">
      {ligne}
      {/* Aligné sur le titre, pas sur la pastille : 8px de padding + 32px d'avatar + 12px de gouttière. */}
      {actions && (
        <div className="flex flex-wrap items-center gap-2 pb-2 pl-[3.25rem] pr-2">{actions}</div>
      )}
    </li>
  );
}

/**
 * Ligne de densité au-dessus d'une liste : intitulé à gauche, volume à
 * droite. Sur mobile elle remplace le `PageHeader` — un titre en 24px
 * suivi d'un compteur ailleurs gaspillait le premier écran.
 */
export function EnteteListe({
  titre,
  compte,
  className,
}: {
  titre: string;
  compte?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mt-2 flex items-end justify-between px-1 md:hidden', className)}>
      <h2 className="text-headline-sm text-on-surface">{titre}</h2>
      {compte && <span className="text-body-sm text-text-secondary">{compte}</span>}
    </div>
  );
}

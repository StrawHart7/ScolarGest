import Link from 'next/link';
import { CircleHelp, GraduationCap, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { RechercheGlobale } from './RechercheGlobale';
import { NotificationsBell } from './NotificationsBell';

export interface HeaderProps {
  schoolName?: string;
  role?: string;
  userName?: string;
}

// Sous `md`, l'espace ne permet pas d'aligner recherche, trois actions,
// badge de rôle et identité. Aide passe dans l'onglet « Plus » de la barre
// basse ; Notifications et Paramètres restent en icônes.
const ACTIONS = [
  { href: '/profil/parametres', libelle: 'Paramètres', Icone: Settings, masquerMobile: false },
  { href: '/profil/aide', libelle: 'Aide', Icone: CircleHelp, masquerMobile: true },
];

/**
 * En-tête unique de toute l'application — monté une seule fois par
 * `AppLayout`, qui est lui-même le point d'entrée de chaque page
 * authentifiée. Il n'existe pas d'autre implémentation d'en-tête : aucune
 * page ne peut donc en afficher un différent, seul son contenu varie
 * (rôle, identité).
 *
 * Sous `md`, il porte la marque — la sidebar qui la portait est masquée — et
 * la recherche globale redescend dans le corps de la page, au plus près de
 * la liste qu'elle filtre.
 */
export function Header({ role, userName }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-surface-border bg-surface-container-low/85 backdrop-blur-md">
      <div className="flex h-header items-center justify-between gap-2 px-gutter sm:gap-4 md:px-6">
        {/* Marque sur mobile uniquement : sur desktop elle est déjà dans la sidebar. */}
        <Link href="/dashboard" className="flex min-w-0 items-center gap-3 md:hidden">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary-container text-white">
            <GraduationCap className="h-5 w-5" aria-hidden />
          </span>
          <span className="truncate text-headline-md font-bold text-primary-container">
            ScolarGest
          </span>
        </Link>

        <div className="hidden w-full max-w-md md:block">
          <RechercheGlobale />
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <NotificationsBell />
          {ACTIONS.map(({ href, libelle, Icone, masquerMobile }) => (
            <Link
              key={href}
              href={href}
              title={libelle}
              aria-label={libelle}
              className={cn(
                'grid h-10 w-10 place-items-center rounded-full text-primary-container transition-colors hover:bg-surface-container-high active:bg-surface-container-high md:h-9 md:w-9 md:rounded md:text-text-secondary md:hover:text-text-primary',
                masquerMobile && 'hidden md:grid',
              )}
            >
              <Icone className="h-[20px] w-[20px] md:h-[18px] md:w-[18px]" aria-hidden />
            </Link>
          ))}

          <span className="mx-2 hidden h-6 w-px bg-surface-border md:block" aria-hidden />

          {role && <Badge variant="primary" className="hidden md:inline-flex">{role}</Badge>}
          <Link
            href="/profil"
            aria-label="Mon profil"
            className="ml-1 flex items-center gap-2 rounded-full text-body-md text-text-secondary transition-colors md:ml-0 md:h-9 md:rounded md:px-2 md:hover:bg-surface-container-high md:hover:text-text-primary"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-surface-border bg-secondary text-label-md text-white md:h-7 md:w-7 md:border-0">
              {(userName ?? 'U').slice(0, 1).toUpperCase()}
            </span>
            <span className="hidden md:inline">{userName}</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

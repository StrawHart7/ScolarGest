import Link from 'next/link';
import { Bell, CircleHelp, Settings } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { RechercheGlobale } from './RechercheGlobale';

export interface HeaderProps {
  schoolName?: string;
  role?: string;
  userName?: string;
}

const ACTIONS = [
  { href: '/profil/notifications', libelle: 'Notifications', Icone: Bell },
  { href: '/profil/parametres', libelle: 'Paramètres', Icone: Settings },
  { href: '/profil/aide', libelle: 'Aide', Icone: CircleHelp },
];

export function Header({ role, userName }: HeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex h-header items-center gap-4 border-b border-surface-border bg-surface-container-low px-6">
      {/* Le nom de la plateforme est déjà porté par la sidebar : cet espace
          sert à la recherche transverse. */}
      <RechercheGlobale />

      <div className="ml-auto flex items-center gap-1">
        {ACTIONS.map(({ href, libelle, Icone }) => (
          <Link
            key={href}
            href={href}
            title={libelle}
            aria-label={libelle}
            className="grid h-9 w-9 place-items-center rounded text-text-secondary transition-colors hover:bg-surface-container-high hover:text-text-primary"
          >
            <Icone className="h-[18px] w-[18px]" aria-hidden />
          </Link>
        ))}

        <span className="mx-2 hidden h-6 w-px bg-surface-border sm:block" aria-hidden />

        {role && <Badge variant="primary">{role}</Badge>}
        <Link
          href="/profil"
          className="flex h-9 items-center gap-2 rounded px-2 text-body-md text-text-secondary transition-colors hover:bg-surface-container-high hover:text-text-primary"
        >
          <span className="grid h-7 w-7 place-items-center rounded-full bg-secondary text-label-md text-white">
            {(userName ?? 'U').slice(0, 1).toUpperCase()}
          </span>
          <span className="hidden sm:inline">{userName}</span>
        </Link>
      </div>
    </header>
  );
}

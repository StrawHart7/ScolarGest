'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BookOpenCheck,
  CircleHelp,
  CreditCard,
  GraduationCap,
  LayoutDashboard,
  Presentation,
  Settings,
  ShieldCheck,
  Users,
  UsersRound,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ITEMS_BAS_SIDEBAR, type NomIcone, type SidebarItem } from '@/lib/navigation';

export type { SidebarItem };

export const ICONES: Record<NomIcone, LucideIcon> = {
  'tableau-de-bord': LayoutDashboard,
  eleves: GraduationCap,
  enseignants: UsersRound,
  notes: BookOpenCheck,
  finances: Wallet,
  etablissement: ShieldCheck,
  rapports: Presentation,
  'mes-classes': Users,
  abonnements: CreditCard,
  utilisateurs: Users,
  parametres: Settings,
  aide: CircleHelp,
};

function LienSidebar({ item, actif }: { item: SidebarItem; actif: boolean }) {
  const Icone = ICONES[item.icone];
  return (
    <li className="relative">
      {actif && (
        <span
          aria-hidden
          className="absolute inset-y-1 left-0 w-[3px] rounded-full bg-primary-container"
        />
      )}
      <Link
        href={item.href}
        aria-current={actif ? 'page' : undefined}
        className={cn(
          'flex items-center gap-3 rounded px-3 py-2 text-body-md transition-colors',
          actif
            ? 'bg-primary-fixed font-semibold text-primary-container'
            : 'text-text-secondary hover:bg-surface-container-high hover:text-text-primary',
        )}
      >
        <Icone className="h-[18px] w-[18px] shrink-0" aria-hidden />
        <span>{item.label}</span>
      </Link>
    </li>
  );
}

export function Sidebar({ items }: { items: SidebarItem[] }) {
  const pathname = usePathname();

  // Une entrée regroupante (« Notes et résultats » → /etablissement/notes) doit
  // rester active sur ses sous-écrans, mais « Établissement » (/etablissement)
  // ne doit pas s'allumer en même temps qu'elle : on retient donc la
  // correspondance la plus longue.
  const hrefActif = items
    .concat(ITEMS_BAS_SIDEBAR)
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <aside className="fixed inset-y-0 left-0 hidden w-sidebar flex-col border-r border-surface-border bg-surface-container-low md:flex">
      <div className="flex h-header items-center gap-2 border-b border-surface-border px-6">
        <span className="grid h-7 w-7 place-items-center rounded bg-primary-container text-label-md text-white">
          S
        </span>
        <span className="text-headline-md text-text-primary">ScolarGest</span>
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-3">
          {items.map((item) => (
            <LienSidebar key={item.href} item={item} actif={hrefActif === item.href} />
          ))}
        </ul>
      </nav>

      {/* Paramètres et Aide restent accessibles sans faire défiler la navigation. */}
      <div className="border-t border-surface-border px-3 py-3">
        <ul className="space-y-1">
          {ITEMS_BAS_SIDEBAR.map((item) => (
            <LienSidebar key={item.href} item={item} actif={hrefActif === item.href} />
          ))}
        </ul>
      </div>
    </aside>
  );
}

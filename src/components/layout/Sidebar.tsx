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
import { useSidebarCollapse } from './sidebar-collapse';

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

function LienSidebar({
  item,
  actif,
  replie,
}: {
  item: SidebarItem;
  actif: boolean;
  replie: boolean;
}) {
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
        title={replie ? item.label : undefined}
        className={cn(
          'flex items-center gap-3 rounded py-2 text-body-md transition-colors',
          replie ? 'justify-center px-0' : 'px-3',
          actif
            ? 'bg-primary-fixed font-semibold text-primary-container'
            : 'text-text-secondary hover:bg-surface-container-high hover:text-text-primary',
        )}
      >
        <Icone className="h-[18px] w-[18px] shrink-0" aria-hidden />
        {!replie && <span className="truncate">{item.label}</span>}
      </Link>
    </li>
  );
}

export function Sidebar({ items }: { items: SidebarItem[] }) {
  const pathname = usePathname();
  const { replie, basculer } = useSidebarCollapse();

  // Une entrée regroupante (« Notes et résultats » → /etablissement/notes) doit
  // rester active sur ses sous-écrans, mais « Établissement » (/etablissement)
  // ne doit pas s'allumer en même temps qu'elle : on retient donc la
  // correspondance la plus longue.
  const hrefActif = items
    .concat(ITEMS_BAS_SIDEBAR)
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-surface-border bg-surface-container-low transition-[width] duration-200 ease-out md:flex',
        replie ? 'w-sidebar-rail' : 'w-sidebar',
      )}
    >
      {/* Le logo est le bouton de bascule : un clic replie/déplie la sidebar. */}
      <button
        type="button"
        onClick={basculer}
        aria-label={replie ? 'Déplier le menu' : 'Replier le menu'}
        aria-pressed={replie}
        title={replie ? 'Déplier le menu' : 'Replier le menu'}
        className={cn(
          'flex h-header items-center gap-2 border-b border-surface-border transition-colors hover:bg-surface-container-high',
          replie ? 'justify-center px-0' : 'px-6',
        )}
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary-container text-white">
          <GraduationCap className="h-5 w-5" aria-hidden />
        </span>
        {!replie && <span className="text-headline-md text-text-primary">ScolarGest</span>}
      </button>

      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-3">
          {items.map((item) => (
            <LienSidebar key={item.href} item={item} actif={hrefActif === item.href} replie={replie} />
          ))}
        </ul>
      </nav>

      {/* Paramètres et Aide restent accessibles sans faire défiler la navigation. */}
      <div className="border-t border-surface-border px-3 py-3">
        <ul className="space-y-1">
          {ITEMS_BAS_SIDEBAR.map((item) => (
            <LienSidebar key={item.href} item={item} actif={hrefActif === item.href} replie={replie} />
          ))}
        </ul>
      </div>
    </aside>
  );
}

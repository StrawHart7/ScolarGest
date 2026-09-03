'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { GraduationCap, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ITEMS_BAS_SIDEBAR, type SidebarItem } from '@/lib/navigation';
import { useSidebarCollapse } from './sidebar-collapse';
import { ICONES } from './icones-navigation';

// Reexport : `BottomNav` importe la table depuis ce module de longue date.
export { ICONES };

export type { SidebarItem };


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
      {/*
        Le logo est le bouton de bascule. Rien ne le disait : l'affordance
        reposait sur le seul `title`, qui n'apparait qu'apres une seconde de
        survol et jamais au tactile. Une icone de panneau l'annonce desormais.

        Depliee, elle se pose a droite du nom. Repliee, il n'y a pas la place :
        c'est le logo lui-meme qui se change en icone au survol — deux calques
        en opacite croisee plutot qu'un rendu conditionnel, pour que rien ne
        saute pendant la transition de largeur.
      */}
      <button
        type="button"
        onClick={basculer}
        aria-label={replie ? 'Déplier le menu' : 'Replier le menu'}
        aria-pressed={replie}
        title={replie ? 'Déplier le menu' : 'Replier le menu'}
        className={cn(
          'group flex h-header items-center gap-2 border-b border-surface-border transition-colors hover:bg-surface-container-high',
          replie ? 'justify-center px-0' : 'px-6',
        )}
      >
        <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary-container text-white">
          <GraduationCap
            className={cn(
              'h-5 w-5 transition-opacity duration-200',
              replie && 'group-hover:opacity-0',
            )}
            aria-hidden
          />
          {replie && (
            <PanelLeftOpen
              className="absolute h-[18px] w-[18px] opacity-0 transition-opacity duration-200 group-hover:opacity-100"
              aria-hidden
            />
          )}
        </span>
        {!replie && (
          <>
            <span className="text-headline-md text-text-primary">ScolarGest</span>
            <PanelLeftClose
              className="ml-auto h-[18px] w-[18px] shrink-0 text-text-secondary/60 transition-colors duration-200 group-hover:text-primary-container"
              aria-hidden
            />
          </>
        )}
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

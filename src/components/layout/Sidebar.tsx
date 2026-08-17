'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export interface SidebarItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
}

export function Sidebar({ items }: { items: SidebarItem[] }) {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 hidden w-sidebar flex-col border-r border-surface-border bg-surface-container-low md:flex">
      <div className="flex h-header items-center border-b border-surface-border px-6">
        <span className="text-headline-md text-text-primary">ScoolAdmin</span>
      </div>
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-0.5 px-3">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <li key={item.href} className="relative">
                {active && (
                  <span
                    aria-hidden
                    className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-primary-container"
                  />
                )}
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2 rounded px-3 py-2 text-body-md transition-colors',
                    active
                      ? 'text-primary-container font-semibold'
                      : 'text-text-secondary hover:bg-surface-container hover:text-text-primary',
                  )}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}

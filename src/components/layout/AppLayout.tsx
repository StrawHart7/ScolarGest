import { Sidebar, type SidebarItem } from './Sidebar';
import { Header } from './Header';
import { AbonnementBanner } from './AbonnementBanner';

export interface AppLayoutProps {
  items: SidebarItem[];
  schoolName?: string;
  role?: string;
  userName?: string;
  children: React.ReactNode;
}

export function AppLayout({ items, schoolName, role, userName, children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-surface">
      <Sidebar items={items} />
      <div className="md:pl-sidebar">
        <Header schoolName={schoolName} role={role} userName={userName} />
        <AbonnementBanner />
        <main className="p-container-pad">{children}</main>
      </div>
    </div>
  );
}

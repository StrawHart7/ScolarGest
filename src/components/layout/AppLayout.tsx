import { Sidebar, type SidebarItem } from './Sidebar';
import { Header } from './Header';
import { AbonnementBanner } from './AbonnementBanner';
import { RappelFinEssai } from './RappelFinEssai';
import { BottomNav } from './BottomNav';
import { BulleSupport } from './BulleSupport';
import { PanneauConseil } from '@/components/conseils/PanneauConseil';
import { SidebarCollapseProvider, ContenuDecale } from './sidebar-collapse';
import { ToastProvider } from '@/components/ui/toast';
import { cheminsAccessibles } from '@/lib/navigation';
import type { Role } from '@/services/tenant';
import { Synchronisation } from '@/components/offline/Synchronisation';
import { IndicateurFile } from '@/components/offline/IndicateurFile';

export interface AppLayoutProps {
  items: SidebarItem[];
  schoolName?: string;
  role?: string;
  userName?: string;
  children: React.ReactNode;
}

export function AppLayout({ items, schoolName, role, userName, children }: AppLayoutProps) {
  return (
    <ToastProvider>
      {/*
        Le moteur de synchronisation enveloppe toute l'application
        authentifiee : une ecriture mise en file depuis un ecran doit partir
        meme si l'utilisateur a navigue ailleurs entre-temps.
      */}
      {/*
        Toutes les destinations du role, pas seulement celles de la barre
        laterale : un ecran atteint depuis une page de section doit lui aussi
        survivre a la coupure. `role` peut manquer sur un rendu partiel, on
        retombe alors sur les seules entrees affichees.
      */}
      <Synchronisation
        cheminsAPrecharger={
          role ? cheminsAccessibles(role as Role) : items.map((item) => item.href)
        }
      >
      <SidebarCollapseProvider>
        <div className="min-h-screen bg-surface">
          <Sidebar items={items} />
          <ContenuDecale>
            <Header schoolName={schoolName} role={role} userName={userName} />
            <AbonnementBanner />
            <IndicateurFile />
            <RappelFinEssai />
            {/*
              Le bas de page doit dégager la barre de navigation flottante :
              56px de hauteur, 24px de décalage du bord, une gouttière, et
              l'encoche des téléphones. Sans cela la dernière ligne d'une liste
              reste inaccessible sous la barre.
            */}
            <main className="px-gutter py-gutter pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:p-container-pad">
              {children}
            </main>
          </ContenuDecale>
          <BottomNav items={items} />
          <BulleSupport role={role} />
          {/*
            Au-dessus de la bulle de support, et jamais en même temps qu'elle
            au même endroit : le support est un recours, le conseil une
            proposition.
          */}
          <PanneauConseil role={role} />
        </div>
      </SidebarCollapseProvider>
      </Synchronisation>
    </ToastProvider>
  );
}

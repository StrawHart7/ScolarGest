import { Sidebar, type SidebarItem } from './Sidebar';
import { Header } from './Header';
import { AbonnementBanner } from './AbonnementBanner';
import { BandeauAnnonce } from './BandeauAnnonce';
import { AnnoncesSidebar } from './AnnoncesSidebar';
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
import { RejeuSignalements } from '@/components/erreur/RejeuSignalements';
import { RegimeProvider } from './RegimeProvider';
import { getRegimePeriodes } from '@/services/regime-periodes';

export interface AppLayoutProps {
  items: SidebarItem[];
  schoolName?: string;
  role?: string;
  userName?: string;
  children: React.ReactNode;
}

export async function AppLayout({ items, schoolName, role, userName, children }: AppLayoutProps) {
  // Lu une seule fois, ici, et diffusé par contexte.
  //
  // Une douzaine d'écrans proposent de choisir une période. Les faire toutes
  // recevoir le régime en props demanderait de toucher autant de pages **et**
  // leurs composants clients, et la première oubliée proposerait un troisième
  // trimestre à un lycée qui n'en a que deux, sans que rien ne le signale.
  // Même raisonnement — et même endroit — que le moteur hors ligne.
  const regime = await getRegimePeriodes();

  return (
    <ToastProvider>
      <RegimeProvider regime={regime}>
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
          {/*
            L'annonce de la plateforme est rendue ici, au serveur, puis passée
            en créneau : `Sidebar` est un composant client et ne peut pas lire
            en base. Voir `AnnoncesSidebar`.
          */}
          <Sidebar items={items} annonces={<AnnoncesSidebar />} />
          <ContenuDecale>
            <Header schoolName={schoolName} role={role} userName={userName} />
            <AbonnementBanner />
            {/*
              Après l'abonnement, délibérément : une perte d'écriture
              imminente passe avant une annonce de la plateforme.

              Ne rend rien à partir de `md` — l'annonce y vit dans la barre
              latérale. Ce bandeau est le rendu du téléphone, où il n'y a pas
              de barre latérale.
            */}
            <BandeauAnnonce />
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
          {/*
            Ne rend rien. Vide le dépôt des signalements d'erreur qui n'avaient
            pas pu partir — typiquement ceux dont la panne **était** le réseau.
            Monté ici et pas sur un écran : il doit se vider à la première page
            qui s'affiche normalement, quelle qu'elle soit.
          */}
          <RejeuSignalements />
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
      </RegimeProvider>
    </ToastProvider>
  );
}

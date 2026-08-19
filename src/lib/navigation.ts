import type { SidebarItem } from '@/components/layout/Sidebar';
import type { Role } from '@/services/tenant';

export function getSidebarItems(role: Role): SidebarItem[] {
  switch (role) {
    case 'SUPER_ADMIN':
      return [
        { label: 'Établissements', href: '/super-admin' },
        { label: 'Abonnements', href: '/super-admin/abonnements' },
      ];
    case 'DIRECTEUR':
      return [
        { label: 'Tableau de bord', href: '/dashboard' },
        { label: 'Cycles', href: '/etablissement/cycles' },
        { label: 'Années scolaires', href: '/etablissement/annees-scolaires' },
        { label: 'Classes', href: '/etablissement/classes' },
        { label: 'Élèves', href: '/etablissement/eleves' },
        { label: 'Enseignants', href: '/etablissement/enseignants' },
        { label: 'Matières', href: '/etablissement/matieres' },
        { label: 'Programme & coefficients', href: '/etablissement/programme' },
        { label: 'Approbation des notes', href: '/etablissement/notes/approbation' },
        { label: 'Moyennes & classement', href: '/etablissement/notes/resultats' },
        { label: 'Bulletins', href: '/etablissement/notes/bulletins' },
        { label: 'Suivi des paiements', href: '/etablissement/finances/factures' },
        { label: 'Versements', href: '/etablissement/finances/paiements' },
        { label: 'Tarifs', href: '/etablissement/finances/tarifs' },
        { label: 'Types de frais', href: '/etablissement/finances/types-frais' },
        { label: 'Utilisateurs', href: '/utilisateurs' },
        { label: 'Rapports & exports', href: '/rapports' },
        { label: 'Mon abonnement', href: '/abonnement' },
      ];
    case 'SECRETAIRE':
      return [
        { label: 'Tableau de bord', href: '/dashboard' },
        { label: 'Classes', href: '/etablissement/classes' },
        { label: 'Élèves', href: '/etablissement/eleves' },
        { label: 'Enseignants', href: '/etablissement/enseignants' },
        { label: 'Matières', href: '/etablissement/matieres' },
        { label: 'Programme & coefficients', href: '/etablissement/programme' },
        { label: 'Approbation des notes', href: '/etablissement/notes/approbation' },
        { label: 'Moyennes & classement', href: '/etablissement/notes/resultats' },
        { label: 'Bulletins', href: '/etablissement/notes/bulletins' },
        { label: 'Suivi des paiements', href: '/etablissement/finances/factures' },
        { label: 'Rapports & exports', href: '/rapports' },
      ];
    case 'COMPTABLE':
      return [
        { label: 'Tableau de bord', href: '/dashboard' },
        { label: 'Suivi des paiements', href: '/etablissement/finances/factures' },
        { label: 'Versements', href: '/etablissement/finances/paiements' },
        { label: 'Tarifs', href: '/etablissement/finances/tarifs' },
        { label: 'Types de frais', href: '/etablissement/finances/types-frais' },
        { label: 'Import financier', href: '/etablissement/finances/import' },
        { label: 'Rapports & exports', href: '/rapports' },
        { label: 'Classes', href: '/etablissement/classes' },
        { label: 'Élèves', href: '/etablissement/eleves' },
      ];
    case 'ENSEIGNANT':
      return [
        { label: 'Tableau de bord', href: '/dashboard' },
        { label: 'Mes classes', href: '/etablissement/mes-classes' },
        { label: 'Saisie des notes', href: '/etablissement/notes/saisie' },
        { label: 'Moyennes & classement', href: '/etablissement/notes/resultats' },
        { label: 'Rapports & exports', href: '/rapports' },
      ];
    default:
      return [];
  }
}

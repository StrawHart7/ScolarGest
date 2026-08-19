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
        { label: 'Utilisateurs', href: '/utilisateurs' },
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
      ];
    case 'COMPTABLE':
      return [
        { label: 'Tableau de bord', href: '/dashboard' },
        { label: 'Classes', href: '/etablissement/classes' },
        { label: 'Élèves', href: '/etablissement/eleves' },
      ];
    case 'ENSEIGNANT':
      return [
        { label: 'Tableau de bord', href: '/dashboard' },
        { label: 'Mes classes', href: '/etablissement/mes-classes' },
        { label: 'Saisie des notes', href: '/etablissement/notes/saisie' },
        { label: 'Moyennes & classement', href: '/etablissement/notes/resultats' },
      ];
    default:
      return [];
  }
}

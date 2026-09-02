import type { Role } from '@/services/tenant';

/**
 * Navigation regroupée par domaine.
 *
 * La sidebar comptait jusqu'à 18 entrées à plat pour un Directeur, ce qui rend
 * l'orientation impossible. Chaque rôle voit désormais 4 à 6 entrées, et une
 * entrée qui couvre plusieurs écrans ouvre une page d'accueil de section
 * présentant ses fonctionnalités en blocs.
 *
 * Les icônes sont désignées par un nom, pas par un composant : `navigation.ts`
 * est importé depuis des Server Components, et un nom reste sérialisable.
 */
export type NomIcone =
  | 'tableau-de-bord'
  | 'eleves'
  | 'enseignants'
  | 'notes'
  | 'finances'
  | 'etablissement'
  | 'rapports'
  | 'mes-classes'
  | 'abonnements'
  | 'utilisateurs'
  | 'parametres'
  | 'aide';

export interface SidebarItem {
  label: string;
  href: string;
  icone: NomIcone;
  /**
   * Libellé de la barre d'onglets basse (mobile). Un onglet fait un cinquième
   * de la largeur d'écran : « Notes et résultats » y est illisible, tronqué à
   * « Notes et r… ». Quand il est absent, `label` est utilisé tel quel.
   */
  labelCourt?: string;
}

/** Une fonctionnalité présentée en bloc sur la page d'accueil d'une section. */
export interface BlocSection {
  titre: string;
  description: string;
  href: string;
  icone: NomIcone;
  /** Rôles autorisés à voir le bloc. */
  roles: Role[];
}

export interface Section {
  titre: string;
  description: string;
  blocs: BlocSection[];
}

const TOUS_ADMIN: Role[] = ['DIRECTEUR', 'SECRETAIRE'];

export const SECTIONS: Record<string, Section> = {
  '/etablissement': {
    titre: 'Établissement',
    description:
      "Structure scolaire, personnel enseignant, comptes utilisateurs et abonnement de l'établissement.",
    blocs: [
      {
        titre: 'Années scolaires',
        description: "Ouvrir, activer et clôturer les années scolaires de l'établissement.",
        href: '/etablissement/annees-scolaires',
        icone: 'etablissement',
        roles: ['DIRECTEUR'],
      },
      {
        titre: 'Cycles et niveaux',
        description: 'Cycles enseignés, niveaux et séries proposés.',
        href: '/etablissement/cycles',
        icone: 'etablissement',
        roles: ['DIRECTEUR'],
      },
      {
        titre: 'Classes',
        description: 'Créer les classes de l’année et suivre leurs effectifs.',
        href: '/etablissement/classes',
        icone: 'etablissement',
        roles: ['DIRECTEUR', 'SECRETAIRE', 'COMPTABLE'],
      },
      {
        titre: 'Matières',
        description: 'Catalogue des matières enseignées.',
        href: '/etablissement/matieres',
        icone: 'notes',
        roles: TOUS_ADMIN,
      },
      {
        titre: 'Programme et coefficients',
        description: 'Matières par niveau et coefficients par série, pour l’année en cours.',
        href: '/etablissement/programme',
        icone: 'notes',
        roles: TOUS_ADMIN,
      },
      {
        titre: 'Enseignants',
        description: 'Fiches des enseignants et affectations aux classes et aux matières.',
        href: '/etablissement/enseignants',
        icone: 'enseignants',
        roles: TOUS_ADMIN,
      },
      {
        titre: 'Identité des documents',
        description: 'Logo et filigrane appliqués aux bulletins et aux reçus.',
        href: '/etablissement/documents',
        icone: 'etablissement',
        roles: ['DIRECTEUR'],
      },
      {
        titre: 'Utilisateurs',
        description: 'Comptes d’accès à la plateforme et rôles associés.',
        href: '/utilisateurs',
        icone: 'utilisateurs',
        roles: ['DIRECTEUR'],
      },
      {
        titre: 'Abonnement',
        description: 'Formule en cours, échéance et renouvellement.',
        href: '/abonnement',
        icone: 'abonnements',
        // Le Comptable peut souscrire et renouveler (`/abonnement/souscrire`) :
        // lui masquer l'entrée le laissait sans aucun chemin vers la page qu'il
        // a pourtant le droit d'utiliser.
        roles: ['DIRECTEUR', 'COMPTABLE'],
      },
    ],
  },
  '/etablissement/notes': {
    titre: 'Notes et résultats',
    description:
      'Saisie, approbation, moyennes, classements et édition des bulletins pour la période en cours.',
    blocs: [
      {
        titre: 'Saisie des notes',
        description: 'Saisir et soumettre les notes de vos évaluations.',
        href: '/etablissement/notes/saisie',
        icone: 'notes',
        roles: ['ENSEIGNANT'],
      },
      {
        titre: 'Approbation des notes',
        description: 'Traiter les demandes de correction soumises par les enseignants.',
        href: '/etablissement/notes/approbation',
        icone: 'notes',
        roles: ['SECRETAIRE'],
      },
      {
        titre: 'Moyennes et classement',
        description: 'Moyennes par matière, moyennes trimestrielles, appréciations et rangs.',
        href: '/etablissement/notes/resultats',
        icone: 'notes',
        roles: ['DIRECTEUR', 'SECRETAIRE', 'ENSEIGNANT'],
      },
      {
        titre: 'Bulletins',
        description: 'Générer et télécharger les bulletins de la période.',
        href: '/etablissement/notes/bulletins',
        icone: 'notes',
        roles: TOUS_ADMIN,
      },
      {
        titre: 'Bulletins édités',
        description: 'Bulletins déjà produits par classe et par trimestre, et ceux qui manquent.',
        href: '/etablissement/notes/bulletins/generes',
        icone: 'notes',
        roles: TOUS_ADMIN,
      },
    ],
  },
  '/etablissement/finances': {
    titre: 'Finances',
    description:
      'Frais de scolarité, tarifs de l’année, facturation des élèves et encaissement des versements.',
    blocs: [
      {
        titre: 'Suivi des paiements',
        description: 'État des factures, soldes restants et relances.',
        href: '/etablissement/finances/factures',
        icone: 'finances',
        roles: ['DIRECTEUR', 'SECRETAIRE', 'COMPTABLE'],
      },
      {
        titre: 'Versements',
        description: 'Encaisser un versement et éditer le reçu correspondant.',
        href: '/etablissement/finances/paiements',
        icone: 'finances',
        roles: ['DIRECTEUR', 'SECRETAIRE', 'COMPTABLE'],
      },
      {
        titre: 'Tarifs',
        description: 'Montants par type de frais, par niveau et par année scolaire.',
        href: '/etablissement/finances/tarifs',
        icone: 'finances',
        roles: ['DIRECTEUR', 'SECRETAIRE', 'COMPTABLE'],
      },
      {
        titre: 'Types de frais',
        description: 'Nature des frais facturables (scolarité, inscription, cantine…).',
        href: '/etablissement/finances/types-frais',
        icone: 'finances',
        roles: ['DIRECTEUR', 'SECRETAIRE', 'COMPTABLE'],
      },
      {
        titre: 'Import financier',
        description: 'Importer un lot de versements depuis un fichier.',
        href: '/etablissement/finances/import',
        icone: 'finances',
        roles: ['SECRETAIRE', 'COMPTABLE'],
      },
    ],
  },
};

/** Blocs d'une section visibles par un rôle donné. */
export function blocsSection(chemin: string, role: Role): BlocSection[] {
  return (SECTIONS[chemin]?.blocs ?? []).filter((bloc) => bloc.roles.includes(role));
}

export function getSidebarItems(role: Role): SidebarItem[] {
  switch (role) {
    case 'SUPER_ADMIN':
      // La vue d'ensemble et l'inventaire des écoles sont deux entrées
      // distinctes : la racine était auparavant les deux à la fois, ce qui la
      // rendait mauvaise dans les deux rôles.
      return [
        { label: 'Vue d’ensemble', labelCourt: 'Accueil', href: '/super-admin', icone: 'tableau-de-bord' },
        { label: 'Établissements', labelCourt: 'Écoles', href: '/super-admin/etablissements', icone: 'etablissement' },
        { label: 'Abonnements', href: '/super-admin/abonnements', icone: 'abonnements' },
        { label: 'Demandes de démo', labelCourt: 'Demandes', href: '/super-admin/demandes', icone: 'utilisateurs' },
        { label: 'Journal d’audit', labelCourt: 'Journal', href: '/super-admin/journal', icone: 'rapports' },
      ];
    case 'DIRECTEUR':
      return [
        { label: 'Tableau de bord', labelCourt: 'Accueil', href: '/dashboard', icone: 'tableau-de-bord' },
        { label: 'Élèves', href: '/etablissement/eleves', icone: 'eleves' },
        { label: 'Notes et résultats', labelCourt: 'Académique', href: '/etablissement/notes', icone: 'notes' },
        { label: 'Finances', href: '/etablissement/finances', icone: 'finances' },
        { label: 'Établissement', labelCourt: 'École', href: '/etablissement', icone: 'etablissement' },
        // Direction et secrétariat seulement : les rôles financiers n'ont
        // rien à faire des moyennes par classe.
        { label: 'Statistiques', labelCourt: 'Stats', href: '/statistiques', icone: 'rapports' },
        { label: 'Rapports', href: '/rapports', icone: 'rapports' },
      ];
    case 'SECRETAIRE':
      return [
        { label: 'Tableau de bord', labelCourt: 'Accueil', href: '/dashboard', icone: 'tableau-de-bord' },
        { label: 'Élèves', href: '/etablissement/eleves', icone: 'eleves' },
        { label: 'Notes et résultats', labelCourt: 'Académique', href: '/etablissement/notes', icone: 'notes' },
        { label: 'Finances', href: '/etablissement/finances', icone: 'finances' },
        { label: 'Établissement', labelCourt: 'École', href: '/etablissement', icone: 'etablissement' },
        // La Secrétaire saisit et suit déjà notes, bulletins et inscriptions :
        // lui refuser la lecture d'ensemble de ce qu'elle produit n'aurait pas
        // de sens.
        { label: 'Statistiques', labelCourt: 'Stats', href: '/statistiques', icone: 'rapports' },
        { label: 'Rapports', href: '/rapports', icone: 'rapports' },
      ];
    case 'COMPTABLE':
      return [
        { label: 'Tableau de bord', labelCourt: 'Accueil', href: '/dashboard', icone: 'tableau-de-bord' },
        { label: 'Finances', href: '/etablissement/finances', icone: 'finances' },
        { label: 'Élèves', href: '/etablissement/eleves', icone: 'eleves' },
        { label: 'Rapports', href: '/rapports', icone: 'rapports' },
        // Entrée directe, et non via « Établissement » que le Comptable n'a
        // pas : il a le droit de souscrire et de renouveler, il lui faut donc
        // un chemin visible en dehors du bandeau d'alerte.
        { label: 'Abonnement', href: '/abonnement', icone: 'abonnements' },
      ];
    case 'ENSEIGNANT':
      return [
        { label: 'Tableau de bord', labelCourt: 'Accueil', href: '/dashboard', icone: 'tableau-de-bord' },
        { label: 'Mes classes', labelCourt: 'Classes', href: '/etablissement/mes-classes', icone: 'mes-classes' },
        { label: 'Notes et résultats', labelCourt: 'Académique', href: '/etablissement/notes', icone: 'notes' },
        { label: 'Rapports', href: '/rapports', icone: 'rapports' },
      ];
    default:
      return [];
  }
}

/** Entrées épinglées en bas de la sidebar, communes à tous les rôles. */
export const ITEMS_BAS_SIDEBAR: SidebarItem[] = [
  { label: 'Paramètres', href: '/profil/parametres', icone: 'parametres' },
  { label: 'Aide', href: '/profil/aide', icone: 'aide' },
];

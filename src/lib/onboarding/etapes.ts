import type { Role } from '@/services/tenant';

/**
 * Définition déclarative du questionnaire de démarrage (`/demarrage`).
 *
 * Les catalogues système étant finis et fermés (4 cycles, 16 niveaux déjà
 * chaînés entre eux, 6 séries), l'essentiel de la configuration est une
 * *sélection dans des listes connues* et non de la génération de texte —
 * d'où un questionnaire scripté plutôt qu'un modèle de langage, qui
 * ajouterait latence, dépendance réseau et risque de proposer un niveau
 * absent du catalogue.
 *
 * Ce fichier ne décrit que la structure du parcours. L'exécution vit dans
 * `src/app/demarrage/actions.ts`, qui appelle les services existants (et
 * donc leurs gardes `requireRole` et leurs `auditLog`).
 */

export type IdEtape =
  // Parcours DIRECTEUR — structure et personnes
  | 'pin'
  | 'annee-scolaire'
  | 'cycles'
  | 'classes'
  | 'enseignants'
  | 'utilisateurs'
  // Parcours SECRETAIRE / COMPTABLE — finance
  | 'types-frais'
  | 'tarifs';

export interface DefinitionEtape {
  id: IdEtape;
  titre: string;
  /** Posée par l'assistant dans le fil. */
  question: string;
  /** Précision affichée sous la question, en retrait. */
  aide?: string;
  /**
   * Avertissement mis en avant avant validation, pour les actions que rien
   * ne permet de défaire ensuite.
   */
  irreversible?: string;
  /** Une étape facultative peut être sautée ; le choix est alors mémorisé. */
  facultative?: boolean;
  /** Le PIN de confirmation est exigé par le service appelé. */
  exigePin?: boolean;
}

/**
 * Ordre imposé par les dépendances réelles, pas par ergonomie :
 *
 * - `pin` d'abord, sinon `exigerPin` lève « Aucun PIN de confirmation n'est
 *   configuré » et bloque `annee-scolaire` comme `cycles` ;
 * - `annee-scolaire` avant tout le reste : classes, coefficients, tarifs y
 *   sont rattachés, et le matricule enseignant s'en sert de séquence ;
 * - `cycles` avant `classes` : les niveaux ne deviennent disponibles qu'une
 *   fois le cycle activé (il n'existe pas de table `niveau_etablissement`,
 *   la disponibilité est implicite).
 *
 * **Trois étapes ont disparu le 2026-09-12** — « Matières », « Programme par
 * niveau » et « Coefficients ». Ce sont des décisions nationales : le
 * découpage de l'année, les matières et leurs coefficients sont fixés par le
 * ministère et leur respect est contrôlé. Un directeur n'a pas à les trancher,
 * et le produit n'a pas à lui laisser saisir des valeurs qui contrediraient
 * l'État.
 *
 * Elles ne sont pas supprimées sans contrepartie : `creerClassesAction`
 * projette le programme et le barème nationaux dès que les classes sont
 * connues — c'est à ce moment seulement qu'on sait quels niveaux sont ouverts.
 * Une matière hors barème national reste ajoutable depuis l'écran du
 * programme.
 */
export const ETAPES_DIRECTEUR: DefinitionEtape[] = [
  {
    id: 'pin',
    titre: 'Code de confirmation',
    question: 'Choisissez un code à 6 chiffres pour confirmer les actions importantes.',
    aide: "Il vous sera demandé avant les décisions définitives, comme l'activation d'un cycle. Il est distinct de votre mot de passe.",
  },
  {
    id: 'annee-scolaire',
    titre: 'Année scolaire',
    question: 'Sur quelle année scolaire travaillez-vous ?',
    aide: 'Les classes, les notes et les factures y seront rattachées.',
    exigePin: true,
  },
  {
    id: 'cycles',
    titre: 'Cycles enseignés',
    question: 'Quels cycles votre établissement enseigne-t-il ?',
    aide: 'Les niveaux correspondants deviendront disponibles à l’étape suivante.',
    irreversible:
      'L’activation d’un cycle est définitive : elle ne peut plus être annulée ensuite.',
    exigePin: true,
  },
  {
    id: 'classes',
    titre: 'Classes',
    question: 'Combien de classes par niveau ?',
    aide: 'Laissez à zéro les niveaux que vous n’enseignez pas. Les noms sont générés automatiquement (6ème A, 6ème B…). Les matières et les coefficients officiels seront appliqués automatiquement.',
  },
  {
    id: 'enseignants',
    titre: 'Enseignants',
    question: 'Souhaitez-vous inviter vos enseignants maintenant ?',
    aide: 'Chaque enseignant reçoit une invitation par email pour activer son compte.',
    facultative: true,
  },
  {
    id: 'utilisateurs',
    titre: 'Équipe administrative',
    question: 'Souhaitez-vous inviter une secrétaire ou un comptable ?',
    aide: 'C’est cette personne qui pourra configurer les frais de scolarité et les tarifs.',
    facultative: true,
  },
];

export const ETAPES_FINANCE: DefinitionEtape[] = [
  {
    id: 'types-frais',
    titre: 'Types de frais',
    question: 'Quels frais votre établissement facture-t-il ?',
    aide: 'Vous pourrez en ajouter d’autres à tout moment.',
  },
  {
    id: 'tarifs',
    titre: 'Tarifs',
    question: 'Quels montants pour chaque niveau ?',
    aide: 'Le montant saisi s’applique à toutes les classes du niveau. Vous pourrez ajuster une classe en particulier depuis l’écran des tarifs.',
  },
];

/** Parcours correspondant au rôle, ou `[]` si le rôle n'en a pas. */
export function etapesPourRole(role: Role): DefinitionEtape[] {
  switch (role) {
    case 'DIRECTEUR':
      return ETAPES_DIRECTEUR;
    case 'SECRETAIRE':
    case 'COMPTABLE':
      return ETAPES_FINANCE;
    default:
      return [];
  }
}

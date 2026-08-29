/**
 * Listes proposées au questionnaire de démarrage (`/demarrage`).
 *
 * Contrairement aux cycles, niveaux et séries — catalogues système seedés en
 * base (`0003_seed_catalogues.sql`) — les matières et les types de frais sont
 * propres à chaque établissement (`matiere` et `type_frais` portent tous deux
 * un `etablissementId`). Il n'existe donc rien à lire : ces listes servent à
 * proposer des cases à cocher plutôt que de laisser le Directeur face à un
 * champ vide. Elles restent purement indicatives, l'ajout libre est toujours
 * possible.
 *
 * Données pures, aucune logique : ce fichier ne doit jamais importer de service
 * ni de client Supabase.
 */

/** Nom de cycle tel que seedé dans la table `cycle`. */
export type NomCycle = 'MATERNELLE' | 'PRIMAIRE' | 'COLLEGE' | 'LYCEE';

export interface MatiereSuggeree {
  nom: string;
  code: string;
  /** Cochée par défaut : le tronc commun réel du cycle au Togo. */
  parDefaut: boolean;
}

const TRONC_SECONDAIRE: MatiereSuggeree[] = [
  { nom: 'Français', code: 'FRA', parDefaut: true },
  { nom: 'Mathématiques', code: 'MATH', parDefaut: true },
  { nom: 'Anglais', code: 'ANG', parDefaut: true },
  { nom: 'Histoire-Géographie', code: 'HG', parDefaut: true },
  { nom: 'Sciences de la Vie et de la Terre', code: 'SVT', parDefaut: true },
  { nom: 'Physique-Chimie', code: 'PC', parDefaut: true },
  { nom: 'Éducation Physique et Sportive', code: 'EPS', parDefaut: true },
  { nom: 'Éducation Civique et Morale', code: 'ECM', parDefaut: false },
  { nom: 'Informatique', code: 'INFO', parDefaut: false },
  { nom: 'Espagnol', code: 'ESP', parDefaut: false },
  { nom: 'Allemand', code: 'ALL', parDefaut: false },
  { nom: 'Philosophie', code: 'PHILO', parDefaut: false },
  { nom: 'Économie', code: 'ECO', parDefaut: false },
];

export const MATIERES_SUGGEREES: Record<NomCycle, MatiereSuggeree[]> = {
  MATERNELLE: [
    { nom: 'Langage', code: 'LANG', parDefaut: true },
    { nom: 'Graphisme et écriture', code: 'GRAPH', parDefaut: true },
    { nom: 'Découverte du monde', code: 'DDM', parDefaut: true },
    { nom: 'Activités artistiques', code: 'ART', parDefaut: true },
    { nom: 'Éducation physique', code: 'EPS', parDefaut: true },
  ],
  PRIMAIRE: [
    { nom: 'Français', code: 'FRA', parDefaut: true },
    { nom: 'Mathématiques', code: 'MATH', parDefaut: true },
    { nom: 'Éveil scientifique', code: 'EVS', parDefaut: true },
    { nom: 'Histoire-Géographie', code: 'HG', parDefaut: true },
    { nom: 'Éducation Civique et Morale', code: 'ECM', parDefaut: true },
    { nom: 'Anglais', code: 'ANG', parDefaut: false },
    { nom: 'Éducation Physique et Sportive', code: 'EPS', parDefaut: true },
    { nom: 'Activités artistiques', code: 'ART', parDefaut: false },
  ],
  COLLEGE: TRONC_SECONDAIRE,
  LYCEE: TRONC_SECONDAIRE,
};

export interface TypeFraisSuggere {
  nom: string;
  description: string;
  parDefaut: boolean;
}

export const TYPES_FRAIS_SUGGERES: TypeFraisSuggere[] = [
  { nom: 'Scolarité', description: 'Frais de scolarité annuels', parDefaut: true },
  { nom: 'Inscription', description: "Frais d'inscription ou de réinscription", parDefaut: true },
  { nom: 'Cantine', description: 'Restauration scolaire', parDefaut: false },
  { nom: 'Transport', description: 'Ramassage scolaire', parDefaut: false },
  { nom: 'Uniforme', description: 'Tenue scolaire', parDefaut: false },
  { nom: 'Fournitures', description: 'Fournitures et manuels scolaires', parDefaut: false },
];

/**
 * Lettres de division utilisées pour nommer les classes d'un même niveau :
 * « 6ème A », « 6ème B »… Au lycée le nom intègre en plus la série
 * (« Tle D1 »), la série remplaçant alors la lettre.
 */
export const LETTRES_DIVISION = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;

/**
 * Libellé d'année scolaire proposé par défaut, déduit de la date du jour.
 * Une année démarrant en septembre, un accès en janvier 2027 doit proposer
 * « 2026-2027 » et non « 2027-2028 ».
 */
function anneeDebut(maintenant: Date): number {
  const annee = maintenant.getFullYear();
  return maintenant.getMonth() >= 7 ? annee : annee - 1;
}

export function libelleAnneeParDefaut(maintenant = new Date()): string {
  const debut = anneeDebut(maintenant);
  return `${debut}-${debut + 1}`;
}

/** Dates par défaut de l'année scolaire proposée (1er septembre → 31 juillet). */
export function datesAnneeParDefaut(maintenant = new Date()): {
  dateDebut: string;
  dateFin: string;
} {
  const debut = anneeDebut(maintenant);
  return { dateDebut: `${debut}-09-01`, dateFin: `${debut + 1}-07-31` };
}

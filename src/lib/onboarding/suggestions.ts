/**
 * Types de frais proposés au questionnaire de démarrage (`/demarrage`).
 *
 * `type_frais` porte un `etablissementId` : chaque école crée les siens, il
 * n'existe aucun catalogue à lire. Cette liste sert à proposer des cases à
 * cocher plutôt que de laisser la Secrétaire face à un champ vide. Purement
 * indicative, l'ajout libre reste possible.
 *
 * **Les matières, elles, ne sont plus ici.** Elles viennent du catalogue
 * officiel du ministère (`matiere_officielle`, migration `0020`), lu en base :
 * une liste en dur ne pourrait pas porter les codes qui rattachent le barème
 * national, et aurait diverge du programme réel à la première révision.
 *
 * Données pures, aucune logique : ce fichier ne doit jamais importer de service
 * ni de client Supabase.
 */

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

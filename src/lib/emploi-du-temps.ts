/**
 * Forme et vocabulaire de l'emploi du temps. **Aucune dépendance.**
 *
 * Ce module existe pour être importable de partout : le gabarit PDF, le
 * composant client de la grille, le service. Loger ces constantes dans
 * `src/services/emploi-du-temps.ts` obligeait le gabarit PDF à importer le
 * service, donc `pin.ts`, donc `bcrypt` — un module natif entraîné dans le
 * graphe d'un simple générateur de HTML.
 *
 * Règle qui en découle : rien ici ne doit jamais importer de service, de
 * client Supabase ni quoi que ce soit de `server-only`.
 */

/** 1 = lundi … 6 = samedi. Le dimanche n'est pas représentable. */
export const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'] as const;

/**
 * Rangs de la journée. Libellés en toutes lettres, sans heure d'horloge :
 * chaque école place sa journée comme elle l'entend.
 */
export const RANGS = [
  'Première heure',
  'Deuxième heure',
  'Troisième heure',
  'Quatrième heure',
  'Cinquième heure',
  'Sixième heure',
  'Septième heure',
  'Huitième heure',
] as const;

export const NOMBRE_JOURS = JOURS.length;
export const NOMBRE_RANGS = RANGS.length;

export interface Creneau {
  id: string;
  etablissementId: string;
  anneeScolaireId: string;
  classeId: string;
  jour: number;
  rang: number;
  matiereId: string;
  enseignantId: string | null;
  salle: string | null;
  matiere: { nom: string; code: string | null };
  enseignant: { nom: string; prenoms: string } | null;
}

import type { AnalyseEntetes } from './entetes';
import type { LigneErreur } from './eleve-import-schema';

/**
 * Vocabulaire commun de l'import en deux temps : on analyse, on montre le
 * bilan, **rien n'est écrit tant que l'utilisateur n'a pas confirmé**.
 *
 * Jusqu'ici le dépôt d'un fichier déclenchait l'écriture immédiate. Deux
 * conséquences : une secrétaire découvrait après coup que 3 lignes sur 233
 * avaient été refusées, et surtout un fichier redéposé pour corriger ces
 * 3 lignes recréait les 230 autres en doublon — élève, inscription et facture
 * compris. L'étape de confirmation n'est pas un confort, c'est ce qui rend
 * l'opération relisable avant d'être irréversible.
 *
 * **Ce module ne dépend de rien** hors types : l'écran d'import l'affiche côté
 * client.
 */

/** Ce qu'il adviendra d'une ligne si l'utilisateur confirme. */
export type StatutLigne =
  /** Sera écrite. */
  | 'PRETE'
  /** Déjà en base : ignorée, sans erreur. Ce n'est pas un échec. */
  | 'DOUBLON'
  /** Ne peut pas être écrite : donnée invalide ou référence introuvable. */
  | 'REFUSEE';

export interface LigneAnalysee {
  /** Numéro de ligne dans le fichier, en-tête comprise (1-based). */
  ligne: number;
  statut: StatutLigne;
  /** Ce que la ligne décrit, pour que l'utilisateur reconnaisse la personne. */
  libelle: string;
  /** Pourquoi elle est ignorée ou refusée. Vide si elle est prête. */
  motif: string;
}

export interface AnalyseImport {
  entetes: AnalyseEntetes;
  /**
   * Lignes de données lues, en-tête exclue. Zéro sur un fichier vide, ce qui
   * n'est pas la même chose qu'un fichier illisible.
   */
  totalLignes: number;
  lignes: LigneAnalysee[];
  /**
   * Erreurs de validation champ par champ. Redondantes avec les lignes
   * `REFUSEE`, mais nécessaires pour dire *quel champ* est en cause.
   */
  erreursValidation: LigneErreur[];
}

export interface DecompteAnalyse {
  pretes: number;
  doublons: number;
  refusees: number;
}

/**
 * Compte les lignes par statut.
 *
 * Les trois catégories sont **distinctes à dessein**. Confondre « doublon » et
 * « refusée » afficherait « 230 échecs » sur un fichier redéposé où tout s'est
 * bien passé : un bilan alarmant apprend vite à ne plus lire les bilans. Un
 * échec appelle une action, un doublon non.
 */
export function compter(lignes: LigneAnalysee[]): DecompteAnalyse {
  return {
    pretes: lignes.filter((l) => l.statut === 'PRETE').length,
    doublons: lignes.filter((l) => l.statut === 'DOUBLON').length,
    refusees: lignes.filter((l) => l.statut === 'REFUSEE').length,
  };
}

/** Y a-t-il quelque chose à écrire ? Sinon le bouton de confirmation n'a pas lieu d'être. */
export function aQuelqueChoseAEcrire(lignes: LigneAnalysee[]): boolean {
  return lignes.some((l) => l.statut === 'PRETE');
}

/**
 * Clé d'identité d'un élève, pour la détection de doublons.
 *
 * Nom + prénoms + date de naissance, normalisés. **Pas la classe** : un élève
 * réinscrit dans une autre classe reste le même élève, et l'inclure ferait
 * échapper à la détection exactement le cas qu'on veut attraper.
 *
 * Deux élèves réels peuvent partager ce triplet. C'est pourquoi la détection
 * écarte la ligne d'un import de masse mais ne pose **aucune contrainte en
 * base** : la saisie individuelle reste ouverte pour le cas légitime. Une
 * contrainte refuserait une inscription réelle sans recours.
 */
export function cleIdentiteEleve(nom: string, prenoms: string, dateNaissance: string): string {
  const n = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
  return `${n(nom)}|${n(prenoms)}|${dateNaissance.trim().slice(0, 10)}`;
}

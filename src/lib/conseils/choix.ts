import {
  CATALOGUE,
  ORDRE_FAMILLES,
  PAR_ID,
  type Conseil,
  type IdConseil,
  type NomSonde,
} from './catalogue';
import type { Role } from '@/services/tenant';

/**
 * Choix du conseil à proposer. Fonction **pure** : elle ne lit rien, ne
 * mesure pas le temps, n'ouvre aucun client Supabase. Tout lui est donné.
 *
 * C'est délibéré et c'est la partie qui compte : le service ne fait que
 * compter des lignes, tandis que l'ordre, le rythme et la relégation sont des
 * règles de produit qui se vérifient à l'oracle — on calcule à la main quel
 * conseil doit sortir, puis on compare. Valider ce classement en le rejouant
 * avec le classement lui-même ne prouverait rien.
 */

/**
 * Mesure d'une sonde. `total` est l'objectif, `fait` ce qui est atteint.
 *
 * `total === 0` signifie **non applicable**, et non « rien de fait » : une
 * école sans aucune classe ne doit pas lire « 0 classes sur 0 ont leur emploi
 * du temps ». Le conseil est alors écarté, pas affiché à zéro.
 */
export interface ValeurSonde {
  fait: number;
  total: number;
}

export type Diagnostic = Partial<Record<NomSonde, ValeurSonde>>;

export type StatutConseil = 'PROPOSE' | 'REPORTE' | 'RELEGUE' | 'SUIVI';

export interface EtatConseil {
  conseilId: IdConseil;
  statut: StatutConseil;
  /** Fin du report « Plus tard », en ISO. */
  reporteJusquA: string | null;
  /** Date de la dernière relégation, en ISO. Ordonne la file de reprise. */
  relegueLe: string | null;
  /** Nombre de relégations successives. Allonge le plancher. */
  nombreRelegations: number;
}

export interface ContexteChoix {
  role: Role;
  diagnostic: Diagnostic;
  historique: EtatConseil[];
  /** Dernier conseil affiché à cet utilisateur, tous conseils confondus. */
  dernierAffichageLe: string | null;
  urlCourante: string;
  /** Une école en lecture seule ne reçoit pas de conseil qui écrit. */
  ecritureAutorisee: boolean;
  maintenant: Date;
  /** Création du compte, pour distinguer une nouveauté d'un usage normal. */
  compteCreeLe: string | null;
}

export interface ConseilAProposer {
  conseil: Conseil;
  /** Texte avec ses jetons substitués. */
  texte: string;
  /** Le compte est antérieur à la fonctionnalité : c'est une nouveauté. */
  nouveaute: boolean;
  /** Le conseil revient depuis la file de relégation. */
  reprise: boolean;
}

const JOUR = 24 * 60 * 60 * 1000;

/** Délai minimal entre deux conseils, quels qu'ils soient. */
export const HEURES_ENTRE_CONSEILS = 24;

/**
 * Plancher avant qu'un conseil relégué puisse revenir, en jours, par nombre
 * de relégations déjà subies.
 *
 * Sans ce plancher, une école bien configurée qui relègue son dernier conseil
 * le reverrait le lendemain : la file principale étant vide, la file de
 * relégation serait servie immédiatement. C'est exactement le harcèlement
 * qu'on cherche à éviter.
 *
 * Le palier s'allonge parce qu'écarter trois fois le même conseil dit quelque
 * chose — sans jamais fermer la porte, puisque le besoin peut naître plus
 * tard. Il n'existe donc aucun état terminal « refusé ».
 */
export const PALIERS_RELEGATION_JOURS = [30, 90, 180];

function plancherRelegation(nombreRelegations: number): number {
  const index = Math.min(Math.max(nombreRelegations, 1), PALIERS_RELEGATION_JOURS.length) - 1;
  return PALIERS_RELEGATION_JOURS[index]!;
}

/** Une sonde est satisfaite quand elle est applicable et atteinte. */
export function sondeSatisfaite(valeur: ValeurSonde | undefined): boolean {
  if (!valeur || valeur.total === 0) return false;
  return valeur.fait >= valeur.total;
}

/** Une sonde absente ou à `total: 0` ne concerne pas cet établissement. */
export function sondeApplicable(valeur: ValeurSonde | undefined): boolean {
  return Boolean(valeur && valeur.total > 0);
}

/**
 * Substitue `{fait}`, `{total}` et `{restant}`.
 *
 * Le texte porte des jetons plutôt qu'une fonction de formatage parce qu'il
 * traverse la frontière serveur/client : passer une fonction à un composant
 * client lève « Functions cannot be passed directly to Client Components », à
 * l'exécution seulement — `tsc` l'accepte, ESLint ne connaît pas la
 * frontière, et le build passe. C'est cette erreur qui a fait tomber le
 * tableau de bord le 2026-09-01.
 */
export function formaterTexte(texte: string, valeur: ValeurSonde | undefined): string {
  if (!valeur) return texte;
  const restant = Math.max(valeur.total - valeur.fait, 0);
  return texte
    .replace(/\{fait\}/g, String(valeur.fait))
    .replace(/\{total\}/g, String(valeur.total))
    .replace(/\{restant\}/g, String(restant));
}

/**
 * Un prérequis est satisfait quand sa sonde l'est, ou quand il ne concerne
 * pas l'établissement.
 *
 * Le second cas est indispensable : un conseil non applicable — une sonde à
 * `total: 0` — bloquerait sinon définitivement tout ce qui en dépend. Un
 * conseil informatif (sans sonde) compte comme satisfait dès qu'il a été
 * suivi, sans quoi la chaîne se figerait sur un conseil que rien ne peut
 * accomplir.
 */
function prerequisSatisfait(
  id: IdConseil,
  diagnostic: Diagnostic,
  parId: Map<IdConseil, EtatConseil>,
): boolean {
  const conseil = PAR_ID.get(id);
  if (!conseil) return true;
  if (conseil.sonde === null) return parId.get(id)?.statut === 'SUIVI';
  const valeur = diagnostic[conseil.sonde];
  return !sondeApplicable(valeur) || sondeSatisfaite(valeur);
}

function correspondAuContexte(conseil: Conseil, url: string): boolean {
  return (conseil.contexte ?? []).some((prefixe) => url.startsWith(prefixe));
}

/**
 * Le conseil à proposer, ou `null` s'il n'y en a aucun — ce qui doit être le
 * cas le plus fréquent, et la fonctionnalité est ratée si ce n'est pas vrai.
 */
export function choisirConseil(contexte: ContexteChoix): ConseilAProposer | null {
  const {
    role,
    diagnostic,
    historique,
    dernierAffichageLe,
    urlCourante,
    ecritureAutorisee,
    maintenant,
    compteCreeLe,
  } = contexte;

  // Le rythme se vérifie avant tout le reste. Côté service, cette garde est
  // lue en une requête : les quinze comptages du diagnostic ne tournent que si
  // l'on a le droit d'afficher quelque chose, ce qui rend la fonctionnalité
  // gratuite la plupart du temps.
  if (dernierAffichageLe !== null) {
    const ecoule = maintenant.getTime() - new Date(dernierAffichageLe).getTime();
    if (ecoule < HEURES_ENTRE_CONSEILS * 60 * 60 * 1000) return null;
  }

  const parId = new Map(historique.map((e) => [e.conseilId, e]));

  const eligibles = CATALOGUE.filter((conseil) => {
    if (!conseil.roles.includes(role)) return false;
    if (conseil.exigeEcriture && !ecritureAutorisee) return false;

    const etat = parId.get(conseil.id);
    if (etat?.statut === 'SUIVI') return false;
    if (etat?.reporteJusquA && new Date(etat.reporteJusquA) > maintenant) return false;

    // Un conseil sans sonde ne devient jamais « satisfait » : c'est son
    // prérequis qui dit s'il a un sens, et le fait de l'avoir suivi qui le
    // retire.
    if (conseil.sonde !== null) {
      const valeur = diagnostic[conseil.sonde];
      if (!sondeApplicable(valeur)) return false;
      if (sondeSatisfaite(valeur)) return false;
    }

    return conseil.prerequis.every((id) => prerequisSatisfait(id, diagnostic, parId));
  });

  if (eligibles.length === 0) return null;

  const principaux = eligibles.filter((c) => parId.get(c.id)?.statut !== 'RELEGUE');

  // On ne sert la file de relégation que lorsque la file principale est vide :
  // « pas pour moi » range en fin de file, il ne supprime pas.
  let pool = principaux;
  let reprise = false;
  if (pool.length === 0) {
    pool = eligibles.filter((conseil) => {
      const etat = parId.get(conseil.id)!;
      if (!etat.relegueLe) return false;
      const attendu = plancherRelegation(etat.nombreRelegations) * JOUR;
      return maintenant.getTime() - new Date(etat.relegueLe).getTime() >= attendu;
    });
    reprise = true;
  }

  if (pool.length === 0) return null;

  const rangFamille = (conseil: Conseil) => ORDRE_FAMILLES.indexOf(conseil.famille);

  const trie = [...pool].sort((a, b) => {
    // La file de reprise est une file : le plus anciennement relégué revient
    // en premier, avant toute considération de famille ou de poids.
    if (reprise) {
      const da = new Date(parId.get(a.id)!.relegueLe!).getTime();
      const db = new Date(parId.get(b.id)!.relegueLe!).getTime();
      if (da !== db) return da - db;
    }
    const familles = rangFamille(a) - rangFamille(b);
    if (familles !== 0) return familles;
    // Le contexte ne départage qu'à famille égale : un conseil de fondation
    // reste prioritaire sur un conseil de confort, fût-il affiché sur sa
    // propre page.
    const contexteA = correspondAuContexte(a, urlCourante) ? 1 : 0;
    const contexteB = correspondAuContexte(b, urlCourante) ? 1 : 0;
    if (contexteA !== contexteB) return contexteB - contexteA;
    if (a.poids !== b.poids) return b.poids - a.poids;
    return a.id.localeCompare(b.id);
  });

  const conseil = trie[0]!;
  const valeur = conseil.sonde ? diagnostic[conseil.sonde] : undefined;

  return {
    conseil,
    texte: formaterTexte(conseil.texte, valeur),
    // Une nouveauté ne l'est que pour qui était déjà là avant elle. Pour un
    // compte créé après, la fonctionnalité a toujours existé, et l'annoncer
    // comme neuve serait faux.
    nouveaute: Boolean(
      conseil.nouveaute &&
        compteCreeLe &&
        new Date(compteCreeLe) < new Date(conseil.nouveaute),
    ),
    reprise,
  };
}

/** Date de fin de report pour « Plus tard ». */
export function reportJusquA(maintenant: Date, jours = 7): string {
  return new Date(maintenant.getTime() + jours * JOUR).toISOString();
}

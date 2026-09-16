/**
 * L'ordre dans lequel une école lit ses classes.
 *
 * **Le tri alphabétique est faux ici, et il l'était partout.** `order('nom')`
 * donnait « 1ère, 2nde, 3ème, 4ème, 5ème, 6ème, Tle » — l'ordre du dictionnaire,
 * qui n'est l'ordre de personne. Un directeur qui cherche sa 6ème A la trouvait
 * en cinquième position, et le menu de choix d'une classe commençait par la
 * Première. Signalé le 2026-09-16.
 *
 * Le bon ordre est celui de la scolarité : **6ème jusqu'à Terminale**. Il est
 * déjà en base — `cycle.ordre` puis `niveau.ordre` — et personne ne s'en
 * servait. Rien à migrer, seulement à lire.
 *
 * Module sans dépendance, délibérément : les menus de choix sont des composants
 * clients, et importer un service y ferait entrer `next/headers` dans le
 * bundle (panne du 2026-09-02).
 */

/** Ce dont le tri a besoin. Volontairement minimal : tout objet qui le porte passe. */
export interface ClasseTriable {
  nom: string;
  niveau?: {
    ordre?: number | null;
    cycle?: { ordre?: number | null } | null;
  } | null;
}

/**
 * Une classe dont le rang est inconnu se range **à la fin**, jamais au début.
 *
 * Le repli compte : une classe d'un cycle retiré du catalogue (maternelle,
 * primaire — voir `0014`) garde ses rangs, donc ce cas ne se présente que
 * lorsque l'appelant a oublié d'embarquer `niveau(ordre, cycle(ordre))`. La
 * mettre en tête ferait passer un défaut de requête pour une décision.
 */
const SANS_RANG = Number.MAX_SAFE_INTEGER;

function rang(classe: ClasseTriable): [number, number] {
  return [
    classe.niveau?.cycle?.ordre ?? SANS_RANG,
    classe.niveau?.ordre ?? SANS_RANG,
  ];
}

/**
 * Compare deux classes : cycle, puis niveau, puis nom.
 *
 * Le nom départage à niveau égal — les divisions d'un même niveau (6ème A,
 * 6ème B) et les séries d'une même année (Tle D1, Tle D2). La comparaison est
 * **numérique** (`numeric: true`), sans quoi « Tle D10 » se rangerait entre
 * « Tle D1 » et « Tle D2 ». Une école à dix divisions n'est pas une hypothèse
 * d'école : c'est le cas ordinaire d'un lycée de Lomé.
 */
export function comparerClasses(a: ClasseTriable, b: ClasseTriable): number {
  const [cycleA, niveauA] = rang(a);
  const [cycleB, niveauB] = rang(b);
  if (cycleA !== cycleB) return cycleA - cycleB;
  if (niveauA !== niveauB) return niveauA - niveauB;
  return a.nom.localeCompare(b.nom, 'fr', { numeric: true, sensitivity: 'base' });
}

/** Rend une copie triée. Ne modifie pas le tableau reçu. */
export function trierClasses<T extends ClasseTriable>(classes: readonly T[]): T[] {
  return [...classes].sort(comparerClasses);
}

/**
 * Fragment de sélection PostgREST à embarquer pour que le tri ait de quoi
 * travailler. Écrit une fois plutôt que recopié : trois services listent des
 * classes, et le premier qui oublie `ordre` obtient un tri alphabétique
 * silencieux — exactement le défaut qu'on corrige.
 */
export const CHAMPS_RANG_CLASSE = 'niveau:niveau(ordre, cycle:cycle(ordre))';

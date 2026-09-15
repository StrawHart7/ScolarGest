import type { TypeEvaluation } from '@/services/evaluation';

/**
 * Comment nommer une évaluation à l'écran.
 *
 * Le numéro n'est affiché que pour une **interrogation** : c'est le seul type
 * qui peut se répéter dans une période, donc le seul où il distingue quelque
 * chose. « Composition n°1 du 1er trimestre » laissait croire qu'il pouvait y
 * en avoir une seconde — il n'y en a qu'une, et c'est désormais la contrainte
 * de base qui le garantit.
 *
 * Les évaluations créées avant le 2026-09-15 peuvent porter un devoir n°2 :
 * deux existent en base. Leur numéro reste donc lisible pour ce type-là aussi
 * quand il dépasse 1 — les effacer ferait apparaître deux lignes identiques
 * dans une liste, sans moyen de les distinguer.
 *
 * Module sans dépendance — seul un `import type`, effacé à la compilation.
 */
export const LIBELLE_TYPE_EVALUATION: Record<TypeEvaluation, string> = {
  INTERROGATION: 'Interrogation',
  DEVOIR: 'Devoir',
  COMPOSITION: 'Composition',
};

export function nommerEvaluation(type: TypeEvaluation, numero: number): string {
  const libelle = LIBELLE_TYPE_EVALUATION[type] ?? type;
  if (type === 'INTERROGATION' || numero > 1) return `${libelle} n°${numero}`;
  return libelle;
}

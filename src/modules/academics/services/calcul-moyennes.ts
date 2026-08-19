/**
 * Moteur de calcul académique — fonctions pures (aucun accès DB).
 * Règles: barème /20, arrondi 2 décimales sur les moyennes retournées.
 * Voir Docs/07 §Calcul et PLAN.md Phase 4.
 */

export function arrondi2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Moyenne des interrogations (0..3 typiquement). null si aucune interro saisie.
 */
export function moyenneInterros(notes: number[]): number | null {
  if (notes.length === 0) return null;
  const sum = notes.reduce((a, b) => a + b, 0);
  return arrondi2(sum / notes.length);
}

/**
 * Moyenne de classe = moyenne des composantes présentes parmi (moy_interros, devoir).
 * Si les deux composantes sont absentes → null.
 */
export function moyenneClasse(
  moyInterros: number | null,
  devoir: number | null,
): number | null {
  const parts: number[] = [];
  if (moyInterros !== null) parts.push(moyInterros);
  if (devoir !== null) parts.push(devoir);
  if (parts.length === 0) return null;
  return arrondi2(parts.reduce((a, b) => a + b, 0) / parts.length);
}

/**
 * Moyenne matière = moyenne des composantes présentes parmi (moy_classe, composition).
 */
export function moyenneMatiere(
  moyClasse: number | null,
  composition: number | null,
): number | null {
  const parts: number[] = [];
  if (moyClasse !== null) parts.push(moyClasse);
  if (composition !== null) parts.push(composition);
  if (parts.length === 0) return null;
  return arrondi2(parts.reduce((a, b) => a + b, 0) / parts.length);
}

export interface MatiereBulletinInput {
  moyenne: number | null;
  coefficient: number;
  obligatoire: boolean;
}

/**
 * Moyenne trimestrielle = Σ(moy × coeff) / Σ(coeff).
 * Matière facultative SANS note → exclue.
 * Matière obligatoire SANS note → comptée à 0 pour ne pas fausser (choix conservateur).
 * Coefficient 0 → poids nul, la matière ne compte pas.
 */
export function moyenneTrimestrielle(items: MatiereBulletinInput[]): number | null {
  let sum = 0;
  let coefTotal = 0;
  for (const item of items) {
    if (item.coefficient <= 0) continue;
    if (item.moyenne === null) {
      if (!item.obligatoire) continue; // facultative sans note → exclue
      // obligatoire sans note: on la considère à 0
      coefTotal += item.coefficient;
      continue;
    }
    sum += item.moyenne * item.coefficient;
    coefTotal += item.coefficient;
  }
  if (coefTotal === 0) return null;
  return arrondi2(sum / coefTotal);
}

/**
 * Moyenne annuelle = moyenne des trimestres non nuls.
 */
export function moyenneAnnuelle(
  t1: number | null,
  t2: number | null,
  t3: number | null,
): number | null {
  const parts = [t1, t2, t3].filter((v): v is number => v !== null);
  if (parts.length === 0) return null;
  return arrondi2(parts.reduce((a, b) => a + b, 0) / parts.length);
}

/**
 * Appréciation automatique. 9 tranches sur 0..20.
 * Bornes: [min, max) sauf la dernière qui inclut 20.
 */
export function appreciation(moy: number): string {
  if (moy < 0 || moy > 20) throw new Error('Moyenne hors barème /20');
  if (moy < 4) return 'Médiocre';
  if (moy < 6) return 'Très Mal';
  if (moy < 8) return 'Très Insuffisant';
  if (moy < 10) return 'Insuffisant';
  if (moy < 12) return 'Passable';
  if (moy < 14) return 'Assez Bien';
  if (moy < 16) return 'Bien';
  if (moy < 18) return 'Très Bien';
  return 'Excellent';
}

export interface RankingEntry {
  id: string;
  moyenne: number | null;
}

export interface RankedEntry {
  id: string;
  rang: number | null; // null si moyenne null
}

/**
 * Classement dense: 2 égalités → même rang, pas de saut.
 * Les entrées avec moyenne null obtiennent rang null (non classés).
 */
export function classement(entries: RankingEntry[]): RankedEntry[] {
  const withScore = entries.filter((e) => e.moyenne !== null) as Array<{
    id: string;
    moyenne: number;
  }>;
  const sorted = [...withScore].sort((a, b) => b.moyenne - a.moyenne);

  const rangById = new Map<string, number>();
  let currentRang = 0;
  let lastScore: number | null = null;
  for (const e of sorted) {
    if (lastScore === null || e.moyenne !== lastScore) {
      currentRang += 1;
      lastScore = e.moyenne;
    }
    rangById.set(e.id, currentRang);
  }

  return entries.map((e) => ({
    id: e.id,
    rang: e.moyenne === null ? null : rangById.get(e.id) ?? null,
  }));
}

import type { ReactElement, SVGProps } from 'react';

/**
 * Façade typée de la mascotte.
 *
 * Le moteur est du JavaScript non typé, repris tel quel de l'export Wobbi
 * (MIT) — 1 800 lignes qu'on ne modifiera pas et qu'il n'y a aucun intérêt à
 * réécrire. `tsconfig.json` garde donc `allowJs: false` et n'inclut que les
 * `.ts`/`.tsx` : c'est cette déclaration, et elle seule, que TypeScript voit.
 * Le bundler, lui, résout `index.js`.
 *
 * Conséquence à connaître : **modifier le moteur ne fait échouer aucun
 * typecheck**. Ce qui est voulu pour du code tiers figé, et à garder en tête si
 * quelqu'un décide un jour d'y toucher.
 */

/**
 * Les dix réactions du préset.
 *
 * Un état inconnu n'est pas une erreur : `resolveState` retombe sur `idle`
 * (voir `preset.js`). Le type est là pour guider, pas pour protéger.
 */
export type EtatScola =
  | 'idle'
  | 'happy'
  | 'thinking'
  | 'surprised'
  | 'sad'
  | 'error'
  | 'success'
  | 'loading'
  | 'sleeping'
  | 'singing';

export interface ScolaProps
  extends Omit<SVGProps<SVGSVGElement>, 'role' | 'width' | 'height' | 'children'> {
  /** Réaction jouée. `idle` par défaut. */
  state?: EtatScola;
  /** Côté du carré, en pixels. 256 par défaut — presque toujours à réduire. */
  size?: number;
  /** `false` fige l'animation sans changer le dessin. */
  playing?: boolean;
  /**
   * Le regard suit le curseur, et un clic déclenche une réaction joyeuse. À
   * mettre à `false` partout où la mascotte n'est qu'une illustration : sinon
   * elle annonce `role="button"` et prend un arrêt de tabulation pour rien.
   */
  interactive?: boolean;
}

export declare function Scola(props: ScolaProps): ReactElement;

import type { Periode } from '@/services/evaluation';

/**
 * Le nom qu'un directeur donne à une période quand il en parle.
 *
 * ## Pourquoi un second module après `lib/bulletins.ts`
 *
 * `lib/bulletins.ts` porte déjà `LIBELLE_PERIODE` — « Trimestre 1 » — et il ne
 * bouge pas : il sert à **nommer un fichier** (« KOFFI Yao - MAT-2026-0031 -
 * Trimestre 1.pdf »), un test le verrouille, et une école qui range ses
 * bulletins par nom de fichier ne doit pas voir sa liste se réordonner sous
 * elle.
 *
 * Celui-ci sert à **écrire une phrase**. Personne ne dit « les notes du
 * trimestre 1 » : on dit « les notes du 1er trimestre ». Cette forme-là était
 * déjà recopiée à l'identique dans huit écrans ; elle vit ici désormais.
 *
 * D'où aussi le nom `phrasePeriode` plutôt que `libellePeriode` : deux
 * fonctions de même nom rendant deux chaînes différentes, c'est une
 * auto-complétion qui choisit mal et un nom de fichier qui change sans que
 * personne l'ait demandé.
 *
 * Le seul import est un `import type`, effacé à la compilation : le module
 * reste chargeable depuis un composant client.
 */
export const PHRASE_PERIODE: Record<Periode, string> = {
  TRIMESTRE_1: '1er trimestre',
  TRIMESTRE_2: '2e trimestre',
  TRIMESTRE_3: '3e trimestre',
};

/** Les trois périodes dans l'ordre de l'année scolaire. */
export const PERIODES_ORDONNEES: Periode[] = ['TRIMESTRE_1', 'TRIMESTRE_2', 'TRIMESTRE_3'];

export function phrasePeriode(periode: Periode): string {
  return PHRASE_PERIODE[periode] ?? periode;
}

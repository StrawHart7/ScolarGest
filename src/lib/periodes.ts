import type { Periode } from '@/services/evaluation';

/**
 * Le nom qu'une école donne à ses périodes, et combien elle en a.
 *
 * ## Deux régimes, une seule énumération
 *
 * Certains lycées togolais fonctionnent au **semestre** — deux périodes — et
 * non au trimestre. On aurait pu ajouter `SEMESTRE_1` et `SEMESTRE_2` au type
 * `periode` ; ça aurait touché une trentaine de fichiers, le moteur de
 * moyennes, les gabarits PDF, les rapports et tous les filtres d'écran, pour
 * une différence qui n'est **pas** dans la donnée.
 *
 * Un semestre est bâti exactement comme un trimestre : mêmes interrogations,
 * même devoir, même composition, mêmes coefficients. Seuls le **nombre** de
 * périodes et le **mot** changent.
 *
 * Une école au semestre emploie donc `TRIMESTRE_1` et `TRIMESTRE_2`, et jamais
 * `TRIMESTRE_3`. La clé est interne ; ce module décide de ce qui s'affiche.
 * Voir la migration `20260915160508_regime_periodes.sql`.
 *
 * ## Pourquoi `lib/bulletins.ts` garde son propre libellé
 *
 * Il porte `LIBELLE_PERIODE` — « Trimestre 1 » — qui sert à **nommer un
 * fichier** (« KOFFI Yao - MAT-2026-0031 - Trimestre 1.pdf »). Un test le
 * verrouille, et une école qui range ses bulletins par nom de fichier ne doit
 * pas voir sa liste se réordonner sous elle. D'où aussi `phrasePeriode` ici
 * plutôt que `libellePeriode` : deux fonctions homonymes rendant deux chaînes
 * différentes, c'est une auto-complétion qui choisit mal.
 *
 * Le seul import est un `import type`, effacé à la compilation : le module
 * reste chargeable depuis un composant client.
 */

export type RegimePeriodes = 'TRIMESTRE' | 'SEMESTRE';

/** Régime d'une école qui n'a rien choisi. Celui de toutes les écoles en base. */
export const REGIME_PAR_DEFAUT: RegimePeriodes = 'TRIMESTRE';

const PHRASE_TRIMESTRE: Record<Periode, string> = {
  TRIMESTRE_1: '1er trimestre',
  TRIMESTRE_2: '2e trimestre',
  TRIMESTRE_3: '3e trimestre',
};

const PHRASE_SEMESTRE: Record<Periode, string> = {
  TRIMESTRE_1: '1er semestre',
  TRIMESTRE_2: '2e semestre',
  // Jamais employée en régime semestriel. Nommée tout de même : une donnée
  // héritée d'un changement de régime doit rester lisible plutôt que
  // s'afficher en clé brute sur un bulletin.
  TRIMESTRE_3: '3e période',
};

/**
 * Les périodes d'une école, dans l'ordre de l'année.
 *
 * **Deux en régime semestriel, et c'est le cœur du changement** : tout écran
 * qui propose de choisir une période doit passer par ici, faute de quoi un
 * lycée au semestre se verrait proposer un troisième trimestre qu'il n'aura
 * jamais.
 */
export function periodesDuRegime(regime: RegimePeriodes = REGIME_PAR_DEFAUT): Periode[] {
  return regime === 'SEMESTRE'
    ? ['TRIMESTRE_1', 'TRIMESTRE_2']
    : ['TRIMESTRE_1', 'TRIMESTRE_2', 'TRIMESTRE_3'];
}

/** « 1er trimestre », ou « 1er semestre » selon le régime de l'école. */
export function phrasePeriode(
  periode: Periode,
  regime: RegimePeriodes = REGIME_PAR_DEFAUT,
): string {
  const table = regime === 'SEMESTRE' ? PHRASE_SEMESTRE : PHRASE_TRIMESTRE;
  return table[periode] ?? periode;
}

/** « trimestre » ou « semestre », pour une phrase courante. */
export function motPeriode(regime: RegimePeriodes = REGIME_PAR_DEFAUT): string {
  return regime === 'SEMESTRE' ? 'semestre' : 'trimestre';
}

/**
 * Les trois périodes de l'énumération, quel que soit le régime.
 *
 * À n'employer que pour **balayer des données existantes** — chercher la
 * dernière période notée, par exemple. Jamais pour proposer un choix : une
 * école au semestre n'a pas de troisième période à offrir.
 */
export const TOUTES_PERIODES: Periode[] = ['TRIMESTRE_1', 'TRIMESTRE_2', 'TRIMESTRE_3'];

/**
 * Conservé sous son ancien nom : plusieurs écrans l'importent déjà. Il vaut
 * les périodes du régime **par défaut**, et un écran qui connaît le régime de
 * son école doit lui préférer `periodesDuRegime`.
 */
export const PERIODES_ORDONNEES: Periode[] = periodesDuRegime();

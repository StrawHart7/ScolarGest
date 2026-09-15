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
 * ## Le choix appartient au lycée, et à lui seul
 *
 * Correction du 2026-09-15, apportée par l'utilisateur : « le régime
 * semestriel, c'est seulement au lycée que c'est possible. Au collège, c'est
 * toujours et toujours le régime trimestriel. »
 *
 * Cela remplace la règle de la veille — « soit c'est semestriel, soit c'est
 * trimestriel, pour toute l'école ». Les deux ne pouvaient pas tenir ensemble :
 * un complexe collège-lycée au semestre **melange** forcement les deux, puisque
 * son collège reste au trimestre. C'est un mélange, mais un mélange qui a un
 * sens scolaire, et c'est la réalité des établissements togolais.
 *
 * Conséquence sur la donnée : `etablissement."regimePeriodes"` ne décrit plus
 * l'école entière, **il décrit son lycée**. La colonne ne change pas, son sens
 * se rétrécit — et comme toutes les écoles en base y portent `TRIMESTRE`,
 * aucune ne voit son comportement bouger.
 *
 * Conséquence sur les écrans : la période se nomme d'après le cycle de la
 * **classe**, jamais d'après l'école. Un écran qui connaît sa classe doit donc
 * passer son cycle ; ceux qui n'en ont aucune retombent sur `regimeDominant`.
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

/**
 * Le nom d'un cycle, tel que la table `cycle` le porte.
 *
 * C'est bien `nom` et non `code` : la table n'a pas de colonne `code`, et ces
 * quatre valeurs y sont écrites en toutes lettres. MATERNELLE et PRIMAIRE ne
 * sont plus proposées depuis la migration `0014`, mais des écoles en gardent
 * des classes — les nommer ici évite qu'elles tombent dans un `default`
 * silencieux.
 */
export type NomCycle = 'MATERNELLE' | 'PRIMAIRE' | 'COLLEGE' | 'LYCEE';

/**
 * Le seul cycle où le découpage de l'année se discute.
 *
 * Partout ailleurs — collège compris, et c'est le point — l'année se découpe
 * en trois trimestres, sans exception et sans réglage.
 */
export const CYCLE_AU_CHOIX: NomCycle = 'LYCEE';

/**
 * Le régime qui s'applique à une classe, d'après son cycle.
 *
 * `regimeLycee` est la valeur de `etablissement."regimePeriodes"`. Elle
 * n'atteint que le lycée : la passer à une classe de collège ne change rien,
 * ce qui est exactement la garantie recherchée.
 *
 * Un cycle inconnu ou absent vaut TRIMESTRE. Se tromper dans ce sens montre
 * trois périodes là où il en fallait deux — la troisième sera simplement vide.
 * Se tromper dans l'autre sens **cacherait** un troisième trimestre déjà noté,
 * et ses notes compteraient dans la moyenne annuelle sans qu'aucun écran ne
 * les montre. Les deux erreurs ne coûtent pas la même chose.
 */
export function regimeDuCycle(
  cycle: NomCycle | string | null | undefined,
  regimeLycee: RegimePeriodes = REGIME_PAR_DEFAUT,
): RegimePeriodes {
  return cycle === CYCLE_AU_CHOIX ? regimeLycee : 'TRIMESTRE';
}

/**
 * Le régime à employer quand aucune classe n'est en vue.
 *
 * Deux écrans sont dans ce cas — les statistiques d'ensemble et le choix d'une
 * période sur les rapports avant d'avoir choisi une classe.
 *
 * La règle : **on ne dit « semestre » que si toute l'école est au semestre**,
 * c'est-à-dire un lycée seul ayant fait ce choix. Dès qu'un collège est là, le
 * trimestre l'emporte — il est le régime du plus grand nombre de classes, et
 * ses trois périodes forment le sur-ensemble des deux du lycée. Un écran global
 * propose ainsi toujours de quoi atteindre chaque donnée ; c'est l'écran de
 * classe qui porte le mot juste.
 */
export function regimeDominant(
  cyclesActifs: readonly (NomCycle | string)[],
  regimeLycee: RegimePeriodes = REGIME_PAR_DEFAUT,
): RegimePeriodes {
  if (cyclesActifs.length === 0) return regimeLycee;
  return cyclesActifs.every((c) => regimeDuCycle(c, regimeLycee) === 'SEMESTRE')
    ? 'SEMESTRE'
    : 'TRIMESTRE';
}

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

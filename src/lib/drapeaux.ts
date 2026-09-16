/**
 * Le vocabulaire des drapeaux, sans dépendance.
 *
 * Un drapeau est un interrupteur posé sur une fonctionnalité du produit et
 * actionné depuis la Régie, sans déploiement. La décision se prend en base
 * (`public.drapeau_actif`), jamais ici : ce module ne porte que les noms.
 *
 * ## Pourquoi les noms vivent dans un module à part
 *
 * **Un code de drapeau inconnu de la base rend `false`**, pas une erreur. Une
 * faute de frappe ne casse donc rien de visible : elle coupe silencieusement la
 * fonctionnalité qu'elle prétendait piloter, pour toutes les écoles, et la
 * panne se découvre au bulletin. Rassembler les noms à un seul endroit permet
 * à un test de les confronter à la migration qui les sème — c'est ce que fait
 * `src/lib/__tests__/drapeaux.test.ts`, en lisant le fichier réel plutôt qu'une
 * copie qui divergerait.
 *
 * **Les codes sont en minuscules.** La Régie les affiche en capitales, mais
 * c'est de la mise en forme : `drapeau_actif` compare la casse, et
 * `REFERENTIEL_NATIONAL` ne trouverait aucune ligne.
 *
 * Le module ne dépend de rien pour rester importable d'un composant client
 * comme du serveur, à la façon de `src/lib/emploi-du-temps.ts`.
 */

export const DRAPEAUX = {
  /** Projection du barème national dans les coefficients, à la création des classes. */
  REFERENTIEL_NATIONAL: 'referentiel_national',
} as const;

export type CodeDrapeau = (typeof DRAPEAUX)[keyof typeof DRAPEAUX];

/** Tous les codes connus du produit, pour les tests et les inventaires. */
export const CODES_DRAPEAUX: CodeDrapeau[] = Object.values(DRAPEAUX);

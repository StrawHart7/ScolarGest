/**
 * Grille tarifaire publique de ScolarGest.
 *
 * **Ce fichier n'est pas la source de vérité de la facturation.** Ce qu'une
 * école paie réellement est figé sur sa ligne `abonnement_etablissement`
 * (`montantTotal`, migration `0015`), et le catalogue applicable vit dans
 * `plan_abonnement`. Les constantes ci-dessous servent l'affichage public.
 *
 * Pourquoi ne pas lire `plan_abonnement` sur la page d'accueil : `listPlans()`
 * exige une session — un catalogue tarifaire n'a pas à être interrogeable sans
 * être connecté — alors que la page de tarifs s'adresse par définition à des
 * visiteurs anonymes. Un fichier de constantes est la réponse honnête ; y
 * brancher une lecture authentifiée ne l'est pas.
 *
 * Toute modification ici doit donc être répercutée dans une migration touchant
 * `plan_abonnement`, et inversement. C'est le prix d'une page publique.
 */

/** Prix mensuel d'un cycle, en francs CFA. */
export const PRIX_MENSUEL_PAR_CYCLE = 10_000;

/** Prix annuel d'un cycle, en francs CFA. */
export const PRIX_ANNUEL_PAR_CYCLE = 100_000;

/** Durée de l'essai gratuit, en jours. */
export const JOURS_ESSAI_GRATUIT = 30;

/**
 * Économie de l'engagement annuel, en pourcentage entier.
 *
 * Calculée plutôt qu'écrite en dur : un prix modifié sans mettre à jour un
 * « -17 % » figé afficherait une remise fausse sur une page publique, ce qui
 * est un problème commercial avant d'être un bug.
 */
export const REMISE_ANNUELLE_POURCENT = Math.round(
  (1 - PRIX_ANNUEL_PAR_CYCLE / (PRIX_MENSUEL_PAR_CYCLE * 12)) * 100,
);

export type Periodicite = 'MOIS' | 'AN';

/** Prix d'un nombre de cycles pour une périodicité donnée. */
export function prixPourCycles(nombreCycles: number, periodicite: Periodicite): number {
  const unitaire =
    periodicite === 'AN' ? PRIX_ANNUEL_PAR_CYCLE : PRIX_MENSUEL_PAR_CYCLE;
  return unitaire * nombreCycles;
}

/**
 * Montant en francs CFA, formaté à la française (espaces insécables fines).
 * `fr-FR` et non `fr-TG` : tous les navigateurs ne connaissent pas la locale
 * togolaise, et le repli silencieux donnerait un format anglo-saxon.
 */
export function formaterFCFA(montant: number): string {
  return `${new Intl.NumberFormat('fr-FR').format(montant)} FCFA`;
}

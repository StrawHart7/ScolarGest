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
 *
 * Les prix eux-mêmes vivent dans `abonnement-formule.ts` et sont réexportés
 * ici : deux déclarations du même montant finiraient par diverger, et c'est
 * une page commerciale qui afficherait alors un prix faux.
 */

export {
  PRIX_MENSUEL_PAR_CYCLE,
  PRIX_ANNUEL_PAR_CYCLE,
  MOIS_OFFERTS_ANNUEL,
  prixPourCycles,
  formaterFCFA,
  type Periodicite,
} from './abonnement-formule';

import { PRIX_ANNUEL_PAR_CYCLE, PRIX_MENSUEL_PAR_CYCLE } from './abonnement-formule';

/*
 * `JOURS_ESSAI_GRATUIT` a ete retire le 2026-09-04.
 *
 * Le site public ne promet plus d'essai gratuit : les premieres ecoles entrent
 * par le programme fondateur, a tarif preferentiel et avec accompagnement. La
 * mecanique d'essai reste **entiere** cote produit (`abonnement-acces.ts`,
 * niveaux ESSAI et AVANT_ESSAI) — c'est la promesse commerciale qui disparait,
 * pas l'outil, que le SUPER_ADMIN peut encore accorder au cas par cas et
 * qu'une offre standard pourra reprendre.
 *
 * Cette reexportation faisait en outre traverser la frontiere serveur a une
 * constante de service depuis un composant client.
 */

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

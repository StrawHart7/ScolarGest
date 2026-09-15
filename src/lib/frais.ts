/**
 * Vocabulaire partagé de l'écran des tarifs.
 *
 * Ce module existe pour une raison précise : un fichier marqué `'use server'`
 * ne peut exporter **que des fonctions asynchrones**. Y déclarer cette
 * constante ferait échouer la compilation Next — pas `tsc`, pas ESLint : le
 * build, et donc le déploiement. Même famille que le composant client qui
 * importe depuis `src/services/` et fait entrer `next/headers` dans le bundle.
 *
 * Sans dépendance, donc chargeable des deux côtés de la frontière.
 */

/**
 * Valeur du choix « un frais qui n'existe pas encore » dans le menu des
 * tarifs. Ce n'est pas un identifiant : l'action la reconnaît et crée le type
 * avant d'enregistrer le montant.
 */
export const NOUVEAU_TYPE_FRAIS = 'NOUVEAU';

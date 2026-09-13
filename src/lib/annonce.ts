/**
 * Vocabulaire des annonces de la plateforme aux écoles.
 *
 * **Ce module ne dépend de rien**, comme `src/lib/telemetrie.ts` et
 * `src/lib/support.ts` : la décision d'affichage doit être testable sans monter
 * de base, et le jour où un composant client en aura besoin, l'importer ne
 * devra pas faire entrer `next/headers` dans le bundle.
 *
 * ## Le sens de la chose
 *
 * Une annonce est écrite dans `public.evenement_global_publie` par le rôle
 * `regie` et par lui seul. Elle voyage donc dans le sens inverse de tout le
 * reste du plan de contrôle : la Régie ne lit rien de l'école, elle lui dit
 * quelque chose. C'est le canal qui ne pose aucune question de confidentialité.
 *
 * Le produit la lit dans sa propre base, sans jamais appeler la Régie. Une page
 * de ScolarGest qui devrait interroger la console fondateur pour s'afficher
 * violerait le principe fondateur : la Régie peut s'éteindre sans conséquence.
 */

export type TypeAnnonce = 'EXAMEN_NATIONAL' | 'ANNONCE' | 'MAINTENANCE';

export interface AnnonceEnCours {
  id: string;
  type: TypeAnnonce;
  titre: string;
  message: string;
  /** `null` = toutes les écoles. Sinon, celles qui enseignent ce cycle. */
  cycleId: string | null;
  finitLe: string;
}

/**
 * Nombre d'annonces affichées simultanément.
 *
 * Trois bandeaux empilés au-dessus d'une page en poussent déjà le contenu hors
 * de l'écran sur un téléphone, et l'abonnement peut en occuper un quatrième.
 * Au-delà, l'annonce cesse d'être une information et devient du décor qu'on
 * apprend à sauter.
 */
export const MAX_ANNONCES_AFFICHEES = 2;

/**
 * L'annonce concerne-t-elle cette école ?
 *
 * Une annonce sans cycle s'adresse à tout le monde. Une annonce portant un
 * cycle ne s'adresse qu'aux écoles qui l'enseignent : « les épreuves du BAC
 * commencent lundi » n'a rien à dire à un collège, et une information qui ne
 * concerne pas son lecteur lui apprend surtout à ne plus lire les suivantes.
 *
 * **En cas de doute, on se tait.** Si les cycles de l'école n'ont pas pu être
 * lus, la liste arrive vide et seules les annonces générales passent. C'est le
 * bon sens du refus : une annonce manquante est un manque d'information, une
 * annonce hors sujet est une perte de crédibilité pour toutes les suivantes.
 */
export function annonceConcerneEcole(
  annonce: Pick<AnnonceEnCours, 'cycleId'>,
  cyclesActifs: readonly string[],
): boolean {
  if (annonce.cycleId === null) return true;
  return cyclesActifs.includes(annonce.cycleId);
}

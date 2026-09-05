/**
 * Vocabulaire du programme « ecoles fondatrices ».
 *
 * Module sans dependance, importable depuis un composant client comme depuis
 * un service — la page de tarifs publique et la console SUPER_ADMIN en ont
 * toutes deux besoin, et un service y ferait entrer `next/headers` dans le
 * bundle.
 *
 * **Le prix n'est pas ici.** Il vit dans `plan_abonnement` (code `FONDATEUR`)
 * et, une fois une ecole admise, il est fige sur elle
 * (`etablissement.tarifFondateurMensuel`). Ce fichier ne porte que des mots et
 * des regles de calcul.
 */

export type RegimeTarifaire = 'STANDARD' | 'FONDATRICE';

export const LIBELLE_REGIME: Record<RegimeTarifaire, string> = {
  STANDARD: 'Tarif standard',
  FONDATRICE: 'École fondatrice',
};

/** Code stable du plan fondateur dans `plan_abonnement`. */
export const CODE_PLAN_FONDATEUR = 'FONDATEUR';

export interface PlacesFondatrices {
  /** Nombre d'ecoles deja admises. */
  prises: number;
  /** Plafond du programme. `null` = pas de limite declaree. */
  max: number | null;
}

/** Places encore ouvertes, jamais negatif. `null` si le programme est illimite. */
export function placesRestantes(places: PlacesFondatrices): number | null {
  if (places.max === null) return null;
  return Math.max(places.max - places.prises, 0);
}

export function programmeComplet(places: PlacesFondatrices): boolean {
  return placesRestantes(places) === 0;
}

/**
 * Montant d'une periode.
 *
 * C'est la seule difference de calcul entre les deux grilles, et elle est
 * volontairement isolee ici : le catalogue standard facture **par cycle**
 * — un complexe college-lycee paie deux fois — tandis que le tarif fondateur
 * est un **forfait par etablissement**, quel que soit le nombre de cycles.
 *
 * Un complexe fondateur paie donc moins qu'un simple college au tarif public.
 * C'est voulu : c'est une offre de lancement, pas une grille.
 */
export function montantPeriode(
  prixUnitaire: number,
  nombreCycles: number,
  parCycle: boolean,
): number {
  return parCycle ? prixUnitaire * nombreCycles : prixUnitaire;
}

/**
 * Phrase de rarete affichee sur la page publique.
 *
 * Elle ne ment jamais par omission : quand le programme est complet, elle le
 * dit, plutot que de laisser une offre alleche un visiteur qui ne pourra pas y
 * entrer. La confiance est l'argument de vente du produit ; une place promise
 * qui n'existe pas la detruit avant meme le premier contact.
 */
export function phrasePlaces(places: PlacesFondatrices): string {
  const restantes = placesRestantes(places);
  if (restantes === null) return 'Programme de lancement.';
  if (restantes === 0) return 'Programme complet — nous constituons une liste d’attente.';
  if (restantes === 1) return 'Il reste 1 place.';
  return `Il reste ${restantes} places sur ${places.max}.`;
}

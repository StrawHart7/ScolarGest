/**
 * Comment s'appelle une classe, et comment s'appellera la suivante.
 *
 * ## Deux conventions qui divergeaient
 *
 * L'onboarding produisait « Terminale D1, D2, D3 » ; la création manuelle
 * proposait un menu d'indices A, B, C, D et donnait « Terminale D A ». Deux
 * chemins, deux nommages, dans la même école — et rien ne rattrapait l'écart
 * ensuite, ni sur les bulletins ni dans les exports.
 *
 * La convention retenue est celle de l'onboarding, parce que c'est l'usage
 * togolais : au lycée, la **série** fait office d'indice et se suffixe d'un
 * chiffre ; au collège, une lettre.
 *
 * ## Une classe seule ne porte pas d'indice
 *
 * Une école qui n'a qu'une sixième l'appelle « 6ème », pas « 6ème A » :
 * l'indice ne sert qu'à distinguer, et il n'y a rien à distinguer quand il n'y
 * en a qu'une. La lettre se lirait comme la promesse d'une 6ème B qui n'existe
 * pas.
 *
 * ## Ce qui n'est délibérément pas fait
 *
 * Quand une seconde classe arrive, la première **n'est pas renommée**. « 6ème »
 * reste « 6ème » et la nouvelle devient « 6ème B ». Renommer serait plus
 * élégant — et toucherait le nom imprimé sur des bulletins déjà remis aux
 * familles. Un nom de classe est une donnée historisée de fait ; on ne réécrit
 * pas le passé pour la symétrie.
 *
 * Module sans dépendance : le formulaire de création est un composant client.
 */

const LETTRES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

/** « Terminale D », « 6ème » : le nom sans son indice. */
export function baseNomClasse(niveauNom: string, serieNom: string | null): string {
  return serieNom ? `${niveauNom} ${serieNom}` : niveauNom;
}

/**
 * Le nom d'une classe de rang `rang` (1 pour la première).
 *
 * Au lycée le chiffre se colle à la série — « Tle D2 » — parce que c'est ainsi
 * qu'on l'écrit au tableau. Au collège, la lettre est séparée par une espace.
 */
export function nommerClasse(niveauNom: string, serieNom: string | null, rang: number): string {
  const base = baseNomClasse(niveauNom, serieNom);
  if (rang <= 1) return base;
  if (serieNom) return `${base}${rang}`;
  return `${base} ${LETTRES[rang - 1] ?? String(rang)}`;
}

/**
 * Le rang déjà atteint par les classes existantes de ce niveau et de cette
 * série. `0` quand il n'y en a aucune.
 *
 * On lit les **noms**, faute de colonne d'indice — et c'est suffisant : ils
 * sont composés par le produit, jamais saisis. Une classe au nom bizarre
 * hérité d'ailleurs compte pour 1, ce qui est le comportement sûr : elle
 * décale la suivante au lieu de risquer un doublon.
 */
export function rangAtteint(
  niveauNom: string,
  serieNom: string | null,
  nomsExistants: readonly string[],
): number {
  const base = baseNomClasse(niveauNom, serieNom);
  const normaliser = (s: string) => s.trim().toLowerCase();
  const baseNorm = normaliser(base);

  let rang = 0;
  for (const nom of nomsExistants) {
    const n = normaliser(nom);
    if (n === baseNorm) {
      // Le nom nu vaut le rang 1 : c'est la première classe du niveau.
      rang = Math.max(rang, 1);
      continue;
    }
    if (!n.startsWith(baseNorm)) continue;

    const suffixe = n.slice(baseNorm.length).trim();
    if (suffixe === '') continue;

    const chiffre = Number(suffixe);
    if (Number.isInteger(chiffre) && chiffre > 0) {
      rang = Math.max(rang, chiffre);
      continue;
    }

    const lettre = LETTRES.indexOf(suffixe.toUpperCase());
    if (lettre >= 0) {
      rang = Math.max(rang, lettre + 1);
      continue;
    }

    // Suffixe non reconnu : on le compte quand même pour ne pas fabriquer un
    // nom déjà pris.
    rang = Math.max(rang, 1);
  }
  return rang;
}

/** Le nom que portera la prochaine classe de ce niveau et de cette série. */
export function prochainNomClasse(
  niveauNom: string,
  serieNom: string | null,
  nomsExistants: readonly string[],
): string {
  return nommerClasse(niveauNom, serieNom, rangAtteint(niveauNom, serieNom, nomsExistants) + 1);
}

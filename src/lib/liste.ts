/**
 * Primitives pures de recherche, tri et pagination partagées par toutes les
 * listes de la plateforme. Volontairement sans dépendance React ni Supabase :
 * les listes sont rendues côté serveur et paginées en mémoire, la logique
 * doit rester testable isolément.
 */

export type SensTri = 'asc' | 'desc';

export interface ParametresListe {
  recherche: string;
  tri?: string;
  sens: SensTri;
  page: number;
  taillePage: number;
}

/** Taille par défaut : tient dans un écran sans scroll vertical. */
export const TAILLE_PAGE_DEFAUT = 10;

/**
 * Normalise pour la recherche : minuscules et diacritiques retirés, de sorte
 * que « eleve » retrouve « Élève » et « Kodjo » retrouve « KODJO ».
 */
export function normaliser(valeur: unknown): string {
  if (valeur === null || valeur === undefined) return '';
  return String(valeur)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function lireParametresListe(
  searchParams: Record<string, string | string[] | undefined>,
  defauts: { tri?: string; sens?: SensTri; taillePage?: number } = {},
): ParametresListe {
  const lire = (cle: string): string | undefined => {
    const brut = searchParams[cle];
    const valeur = Array.isArray(brut) ? brut[0] : brut;
    return valeur && valeur.length > 0 ? valeur : undefined;
  };
  const page = Number.parseInt(lire('page') ?? '1', 10);
  const sens = lire('sens');
  return {
    recherche: lire('q') ?? '',
    tri: lire('tri') ?? defauts.tri,
    sens: sens === 'desc' ? 'desc' : sens === 'asc' ? 'asc' : (defauts.sens ?? 'asc'),
    page: Number.isFinite(page) && page > 0 ? page : 1,
    taillePage: defauts.taillePage ?? TAILLE_PAGE_DEFAUT,
  };
}

/** Conserve les lignes dont au moins un champ interrogé contient le terme. */
export function rechercher<T>(lignes: T[], terme: string, champs: (ligne: T) => unknown[]): T[] {
  const cible = normaliser(terme);
  if (!cible) return lignes;
  const mots = cible.split(/\s+/).filter(Boolean);
  return lignes.filter((ligne) => {
    const foin = champs(ligne).map(normaliser).join(' ');
    return mots.every((mot) => foin.includes(mot));
  });
}

/**
 * Tri stable. Les valeurs nulles sont toujours reléguées en fin de liste,
 * quel que soit le sens : un élève sans moyenne ne doit pas se retrouver
 * premier du classement parce qu'on a trié en croissant.
 */
export function trier<T>(lignes: T[], sens: SensTri, valeur: (ligne: T) => unknown): T[] {
  const facteur = sens === 'desc' ? -1 : 1;
  return lignes
    .map((ligne, index) => ({ ligne, index }))
    .sort((a, b) => {
      const va = valeur(a.ligne);
      const vb = valeur(b.ligne);
      const aVide = va === null || va === undefined || va === '';
      const bVide = vb === null || vb === undefined || vb === '';
      if (aVide && bVide) return a.index - b.index;
      if (aVide) return 1;
      if (bVide) return -1;
      let comparaison: number;
      if (typeof va === 'number' && typeof vb === 'number') {
        comparaison = va - vb;
      } else if (va instanceof Date && vb instanceof Date) {
        comparaison = va.getTime() - vb.getTime();
      } else {
        comparaison = String(va).localeCompare(String(vb), 'fr', { numeric: true });
      }
      return comparaison !== 0 ? comparaison * facteur : a.index - b.index;
    })
    .map((entree) => entree.ligne);
}

export interface Pagination<T> {
  lignes: T[];
  page: number;
  nombrePages: number;
  total: number;
  debut: number;
  fin: number;
}

/** Ramène toujours la page dans les bornes : un filtre peut vider la page courante. */
export function paginer<T>(lignes: T[], page: number, taillePage: number): Pagination<T> {
  const total = lignes.length;
  const nombrePages = Math.max(1, Math.ceil(total / taillePage));
  const pageSure = Math.min(Math.max(1, page), nombrePages);
  const debut = (pageSure - 1) * taillePage;
  const fin = Math.min(debut + taillePage, total);
  return {
    lignes: lignes.slice(debut, fin),
    page: pageSure,
    nombrePages,
    total,
    debut: total === 0 ? 0 : debut + 1,
    fin,
  };
}

/**
 * Chaîne recherche → tri → pagination en une passe, dans l'ordre attendu :
 * on pagine le résultat filtré, jamais l'inverse.
 */
export function preparerListe<T>(
  lignes: T[],
  parametres: ParametresListe,
  options: {
    champsRecherche?: (ligne: T) => unknown[];
    valeursTri?: Record<string, (ligne: T) => unknown>;
  } = {},
): Pagination<T> {
  let resultat = lignes;
  if (options.champsRecherche) {
    resultat = rechercher(resultat, parametres.recherche, options.champsRecherche);
  }
  const accesseur = parametres.tri ? options.valeursTri?.[parametres.tri] : undefined;
  if (accesseur) {
    resultat = trier(resultat, parametres.sens, accesseur);
  }
  return paginer(resultat, parametres.page, parametres.taillePage);
}

/**
 * Enveloppe un décompte total et une tranche déjà découpée par la base.
 *
 * `preparerListe` ci-dessus découpe en mémoire : correct tant que la table
 * entière tient dans la réponse, ruineux dès qu'elle grossit — afficher les
 * élèves 11 à 20 retéléchargeait les mille autres. Les services qui savent
 * paginer côté SQL (`.range()` + `count: 'exact'`) renvoient leur résultat
 * ici, sans repasser par un tri applicatif qui n'aurait vue que sur la page
 * courante.
 */
export function paginationDepuisBase<T>(
  lignes: T[],
  total: number,
  page: number,
  taillePage: number,
): Pagination<T> {
  const nombrePages = Math.max(1, Math.ceil(total / taillePage));
  const pageCourante = Math.min(Math.max(1, page), nombrePages);
  return {
    lignes,
    page: pageCourante,
    nombrePages,
    total,
    debut: total === 0 ? 0 : (pageCourante - 1) * taillePage + 1,
    fin: Math.min(pageCourante * taillePage, total),
  };
}

/** Bornes `.range()` (inclusives) correspondant à une page. */
export function bornesPage(page: number, taillePage: number): { de: number; a: number } {
  const debut = Math.max(0, (Math.max(1, page) - 1) * taillePage);
  return { de: debut, a: debut + taillePage - 1 };
}

import * as XLSX from 'xlsx';

/**
 * Lecture d'un classeur Excel, partagée par les trois imports.
 *
 * Les trois services en portaient chacun une copie identique de `parseFichierExcel`,
 * ce qui garantissait qu'une correction n'en toucherait qu'un sur trois.
 *
 * **Serveur uniquement** : ce module importe `xlsx`. Ne jamais l'importer
 * depuis un composant client — le contrôle des en-têtes, lui, vit dans
 * `entetes.ts`, qui ne dépend de rien.
 */

export interface LigneBrute {
  /** Numéro de ligne dans le fichier (1-based, en-tête comprise). */
  ligne: number;
  valeurs: Record<string, unknown>;
}

export interface ClasseurLu {
  /** En-têtes de la première ligne, dans l'ordre du fichier. */
  entetes: string[];
  lignes: LigneBrute[];
}

/**
 * Noms de colonne qu'on refuse de reporter sur un objet.
 *
 * Une colonne du fichier devient une clé de `valeurs`. Écrire
 * `objet['__proto__'] = …` ne crée pas une propriété : ça **remplace le
 * prototype**. Aucun fichier scolaire ne nomme une colonne ainsi ; un fichier
 * qui le fait cherche autre chose.
 */
const CLES_INTERDITES = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Lit la première feuille : en-têtes bruts et lignes de données.
 *
 * Les clés des lignes sont **normalisées en minuscules** et débarrassées de
 * leurs espaces de bord, comme `normaliserEntete`. Sans cela un fichier dont
 * l'en-tête dit « Nom » passerait le contrôle d'en-têtes — qui compare en
 * minuscules — puis produirait un « Nom requis » sur chacune de ses lignes,
 * parce que la lecture, elle, cherchait la clé exacte. Les deux étapes doivent
 * s'accorder sur ce qu'est une colonne.
 *
 * ## Une seule lecture, en matrice, et c'est une décision de sécurité
 *
 * Il y avait deux appels à `sheet_to_json` : un en mode matrice pour les
 * en-têtes, un en mode objet pour les lignes. Le second est le chemin de la
 * pollution de prototype de SheetJS (GHSA-4r6h-8v6p-xvw6) : c'est **la
 * bibliothèque** qui construit alors les objets, en prenant pour clés les
 * en-têtes du fichier, et une colonne nommée `__proto__` atteint le prototype
 * de tous les objets du processus.
 *
 * Le paquet npm `xlsx` est figé en 0.18.5 — SheetJS a quitté npm, et le
 * correctif ne vit que sur son propre CDN. Y aller ferait dépendre chaque
 * `npm ci` et chaque déploiement d'un service tiers, ce que ce dépôt s'interdit
 * depuis l'incident Sentry du 2026-09-01. On retire donc le vecteur au lieu
 * d'attendre une version : la matrice ne rend que des tableaux, et c'est nous
 * qui fabriquons les objets, en refusant trois noms de clé.
 *
 * ## Effet de bord : les numéros de ligne redeviennent justes
 *
 * Le mode objet **saute les lignes entièrement vides**, et le numéro annoncé
 * était `index + 2`. Une seule ligne blanche au milieu d'un fichier décalait
 * donc tout le rapport d'import : « erreur ligne 34 » désignait la 35. Le
 * numéro vient maintenant de la position réelle dans la feuille.
 */
export function lireClasseur(buffer: ArrayBuffer | Buffer): ClasseurLu {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { entetes: [], lignes: [] };
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return { entetes: [], lignes: [] };

  const matrice = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  });
  const entetes = (matrice[0] ?? []).map((v) => String(v ?? ''));
  const cles = entetes.map((e) => e.trim().toLowerCase());

  const lignes: LigneBrute[] = [];
  for (let index = 1; index < matrice.length; index += 1) {
    const cellules = matrice[index] ?? [];
    // Une ligne blanche n'est pas une ligne en erreur : la sauter évite un
    // rapport rempli de « Nom requis » sur les lignes vides de fin de fichier,
    // que tout tableur produit en quantité.
    if (cellules.every((v) => String(v ?? '').trim() === '')) continue;

    const valeurs: Record<string, unknown> = {};
    cles.forEach((cle, colonne) => {
      if (!cle || CLES_INTERDITES.has(cle)) return;
      valeurs[cle] = cellules[colonne] ?? '';
    });
    lignes.push({ ligne: index + 1, valeurs }); // +1 : la feuille est 1-based
  }

  return { entetes, lignes };
}

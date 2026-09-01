/**
 * Geometrie des graphes. **Aucune dependance, aucun rendu** — que des nombres.
 *
 * Isole ici parce que c'est la seule vraie mathematique du lot, et donc la
 * seule partie qu'on peut tester sans monter un DOM.
 */

export interface Bornes {
  /** Toujours 0 : une courbe d'argent tronquee en bas ment sur les proportions. */
  min: 0;
  max: number;
  /** Valeurs des lignes de graduation, de bas en haut. */
  graduations: number[];
}

/**
 * Choisit un plafond « rond » au-dessus du maximum observe.
 *
 * Un axe qui s'arrete pile sur la valeur maximale colle la courbe au bord
 * superieur et donne l'impression d'un plafond atteint. On monte donc au
 * prochain pas rond (1, 2, 2.5 ou 5 fois une puissance de dix), ce qui donne
 * aussi des graduations lisibles — 0 / 25k / 50k plutot que 0 / 23 847 / 47 694.
 *
 * Le minimum est fixe a zero, jamais au minimum observe. Tronquer la base
 * d'une courbe de recettes exagere visuellement les variations : un mois a
 * 90 000 apres un mois a 100 000 semblerait un effondrement.
 */
export function calculerBornes(valeurs: number[], nombreGraduations = 4): Bornes {
  const max = Math.max(0, ...valeurs);
  if (max === 0) {
    // Serie entierement vide : une echelle 0..1 evite une division par zero et
    // affiche une ligne de base plate, ce qui est la verite.
    return { min: 0, max: 1, graduations: [0, 1] };
  }

  const pasBrut = max / nombreGraduations;
  const puissance = 10 ** Math.floor(Math.log10(pasBrut));
  const normalise = pasBrut / puissance;
  const facteur = normalise <= 1 ? 1 : normalise <= 2 ? 2 : normalise <= 2.5 ? 2.5 : normalise <= 5 ? 5 : 10;
  const pas = facteur * puissance;

  const plafond = Math.ceil(max / pas) * pas;
  const graduations: number[] = [];
  for (let v = 0; v <= plafond + pas / 2; v += pas) graduations.push(Number(v.toFixed(6)));
  return { min: 0, max: plafond, graduations };
}

export interface Point {
  x: number;
  y: number;
}

/**
 * Repartit `nombre` points sur la largeur utile.
 *
 * Les points touchent les deux bords : une courbe de douze mois doit commencer
 * a gauche et finir a droite, sans marge interieure qui laisserait croire a des
 * mois manquants.
 */
export function positionsX(nombre: number, largeur: number): number[] {
  if (nombre <= 1) return [largeur / 2];
  const pas = largeur / (nombre - 1);
  return Array.from({ length: nombre }, (_, i) => i * pas);
}

/** Projette une valeur sur la hauteur, origine en haut comme en SVG. */
export function positionY(valeur: number, bornes: Bornes, hauteur: number): number {
  return hauteur - (valeur / bornes.max) * hauteur;
}

/**
 * Trace une courbe lissee passant par tous les points.
 *
 * **Interpolation monotone (Fritsch-Carlson), pas une spline de Catmull-Rom.**
 * La difference n'est pas cosmetique : une spline classique depasse entre deux
 * points quand la pente s'inverse brutalement. Sur une courbe d'encaissements,
 * un mois a 0 suivi d'un mois a 500 000 ferait plonger le trace **sous zero** —
 * le graphe montrerait des recettes negatives, qui n'existent pas. La variante
 * monotone borne chaque tangente et ne depasse jamais les valeurs voisines.
 *
 * Retourne un chemin SVG ; deux points ou moins donnent des segments droits,
 * lisser n'ayant alors aucun sens.
 */
export function cheminLisse(points: Point[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0]!.x} ${points[0]!.y}`;
  if (points.length === 2) {
    return `M ${points[0]!.x} ${points[0]!.y} L ${points[1]!.x} ${points[1]!.y}`;
  }

  const n = points.length;
  // Pentes des segments.
  const pentes: number[] = [];
  for (let i = 0; i < n - 1; i += 1) {
    const dx = points[i + 1]!.x - points[i]!.x;
    pentes.push(dx === 0 ? 0 : (points[i + 1]!.y - points[i]!.y) / dx);
  }

  // Tangente en chaque point, bornee pour rester monotone.
  const tangentes: number[] = new Array(n).fill(0);
  tangentes[0] = pentes[0]!;
  tangentes[n - 1] = pentes[n - 2]!;
  for (let i = 1; i < n - 1; i += 1) {
    const avant = pentes[i - 1]!;
    const apres = pentes[i]!;
    // Un extremum local : tangente nulle, sinon le trace depasserait.
    if (avant * apres <= 0) {
      tangentes[i] = 0;
      continue;
    }
    const moyenne = (avant + apres) / 2;
    const limite = 3 * Math.min(Math.abs(avant), Math.abs(apres));
    tangentes[i] = Math.abs(moyenne) > limite ? Math.sign(moyenne) * limite : moyenne;
  }

  let chemin = `M ${arrondi(points[0]!.x)} ${arrondi(points[0]!.y)}`;
  for (let i = 0; i < n - 1; i += 1) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const dx = b.x - a.x;
    const c1x = a.x + dx / 3;
    const c1y = a.y + (tangentes[i]! * dx) / 3;
    const c2x = b.x - dx / 3;
    const c2y = b.y - (tangentes[i + 1]! * dx) / 3;
    chemin += ` C ${arrondi(c1x)} ${arrondi(c1y)}, ${arrondi(c2x)} ${arrondi(c2y)}, ${arrondi(b.x)} ${arrondi(b.y)}`;
  }
  return chemin;
}

/** Deux decimales suffisent en coordonnees SVG et allegent le HTML rendu. */
function arrondi(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Arc d'anneau, en coordonnees SVG, centre sur (cx, cy).
 *
 * Les angles partent de midi et tournent dans le sens horaire — la convention
 * de lecture d'un cadran. `arcAnneau` decrit une couronne fermee (bord exterieur
 * puis bord interieur en sens inverse) plutot qu'un trait epais : un `stroke`
 * epais produit des extremites qui debordent l'angle demande, ce qui fausse les
 * proportions sur les petites parts.
 */
export function arcAnneau(
  cx: number,
  cy: number,
  rayonExterieur: number,
  rayonInterieur: number,
  angleDebut: number,
  angleFin: number,
): string {
  const balaye = angleFin - angleDebut;
  // Un tour complet ne peut pas s'ecrire en un seul arc : les deux extremites
  // seraient confondues et le chemin serait vide. On le coupe en deux moities.
  if (balaye >= 359.999) {
    const moitie = angleDebut + 180;
    return (
      arcAnneau(cx, cy, rayonExterieur, rayonInterieur, angleDebut, moitie) +
      ' ' +
      arcAnneau(cx, cy, rayonExterieur, rayonInterieur, moitie, angleDebut + 359.999)
    );
  }

  const p = (rayon: number, angle: number): Point => {
    const rad = ((angle - 90) * Math.PI) / 180;
    return { x: arrondi(cx + rayon * Math.cos(rad)), y: arrondi(cy + rayon * Math.sin(rad)) };
  };

  const grandArc = balaye > 180 ? 1 : 0;
  const e1 = p(rayonExterieur, angleDebut);
  const e2 = p(rayonExterieur, angleFin);
  const i2 = p(rayonInterieur, angleFin);
  const i1 = p(rayonInterieur, angleDebut);

  return [
    `M ${e1.x} ${e1.y}`,
    `A ${rayonExterieur} ${rayonExterieur} 0 ${grandArc} 1 ${e2.x} ${e2.y}`,
    `L ${i2.x} ${i2.y}`,
    `A ${rayonInterieur} ${rayonInterieur} 0 ${grandArc} 0 ${i1.x} ${i1.y}`,
    'Z',
  ].join(' ');
}

/** Libelle court d'un mois `yyyy-MM` : « janv. », « févr. »… */
export function libelleMois(cle: string): string {
  const [annee = 1970, mois = 1] = cle.split('-').map(Number);
  return new Date(Date.UTC(annee, mois - 1, 1)).toLocaleDateString('fr-FR', {
    month: 'short',
    timeZone: 'UTC',
  });
}

/**
 * Abrege un montant pour un axe : 1 500 000 → « 1,5 M », 25 000 → « 25 k ».
 *
 * Reserve aux graduations et aux axes. Les montants lus par un comptable
 * restent en toutes lettres via `formaterFCFA` — un recu n'arrondit pas.
 */
export function abregerMontant(valeur: number): string {
  if (valeur === 0) return '0';
  if (Math.abs(valeur) >= 1_000_000) {
    const v = valeur / 1_000_000;
    return `${(Math.round(v * 10) / 10).toLocaleString('fr-FR')} M`;
  }
  if (Math.abs(valeur) >= 1_000) {
    const v = valeur / 1_000;
    return `${(Math.round(v * 10) / 10).toLocaleString('fr-FR')} k`;
  }
  return valeur.toLocaleString('fr-FR');
}

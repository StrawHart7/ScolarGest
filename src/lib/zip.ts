/**
 * Écriture d'une archive ZIP, sans dépendance.
 *
 * **Le ZIP est un repli, pas le chemin principal.** Quand le navigateur le
 * permet (Chrome, Edge sur ordinateur), les bulletins sont écrits un par un
 * dans un dossier choisi par l'utilisateur : rien à dézipper, ce qui compte
 * pour une secrétaire qui imprime une pile de bulletins. Firefox, Safari et
 * les navigateurs mobiles n'ont pas cette API et aucune page web n'y a le
 * droit d'écrire un dossier — d'où cette archive.
 *
 * Méthode « stored » (0), sans compression : un PDF est déjà compressé, le
 * dégonfler une seconde fois ne gagne presque rien et imposerait `deflate`,
 * donc une dépendance ou une implémentation autrement plus longue. Le format
 * reste un ZIP parfaitement standard, lisible par l'Explorateur Windows, le
 * Finder et tous les outils courants.
 *
 * Pas de Zip64 : au-delà de 4 Go d'archive ou de 65 535 fichiers, il faudrait
 * l'ajouter. Une classe compte quelques dizaines de bulletins de quelques
 * centaines de kilo-octets — trois ordres de grandeur sous la limite.
 */

export interface FichierZip {
  /** Nom dans l'archive. Les séparateurs de chemin sont interdits. */
  nom: string;
  contenu: Uint8Array;
}

/** Table précalculée du CRC-32 (polynôme 0xEDB88320), norme du format ZIP. */
const TABLE_CRC = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let valeur = i;
    for (let bit = 0; bit < 8; bit += 1) {
      valeur = valeur & 1 ? 0xedb88320 ^ (valeur >>> 1) : valeur >>> 1;
    }
    table[i] = valeur >>> 0;
  }
  return table;
})();

export function crc32(donnees: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < donnees.length; i += 1) {
    crc = TABLE_CRC[(crc ^ donnees[i]!) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Assainit un nom de fichier destiné à une archive ou à un dossier.
 *
 * Un nom d'élève peut contenir une barre oblique (« KOFFI/AGBO », saisie
 * fautive mais fréquente) : laissée telle quelle, elle créerait un
 * sous-dossier à l'extraction, voire sortirait du dossier cible. Les
 * caractères interdits par Windows sont également retirés, sans quoi
 * l'archive serait illisible là où elle sera le plus souvent ouverte.
 */
export function nomFichierSur(nom: string): string {
  const nettoye = nom
    .replace(/[/\\:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  return nettoye.length > 0 ? nettoye.slice(0, 120) : 'document';
}

function ecrireEntier(vue: DataView, position: number, valeur: number, octets: 2 | 4): void {
  if (octets === 2) vue.setUint16(position, valeur, true);
  else vue.setUint32(position, valeur >>> 0, true);
}

/**
 * Construit l'archive. Les noms sont encodés en UTF-8 et le drapeau
 * correspondant est posé, sinon un prénom accentué ressort en mojibake sous
 * Windows.
 */
export function construireZip(fichiers: FichierZip[]): Uint8Array {
  const encodeur = new TextEncoder();
  const entrees = fichiers.map((f) => ({
    nom: encodeur.encode(nomFichierSur(f.nom)),
    contenu: f.contenu,
    crc: crc32(f.contenu),
  }));

  const tailleLocale = entrees.reduce((s, e) => s + 30 + e.nom.length + e.contenu.length, 0);
  const tailleCentrale = entrees.reduce((s, e) => s + 46 + e.nom.length, 0);
  const sortie = new Uint8Array(tailleLocale + tailleCentrale + 22);
  const vue = new DataView(sortie.buffer);

  const decalages: number[] = [];
  let position = 0;

  for (const entree of entrees) {
    decalages.push(position);
    ecrireEntier(vue, position, 0x04034b50, 4); // signature d'en-tête local
    ecrireEntier(vue, position + 4, 20, 2); // version minimale
    ecrireEntier(vue, position + 6, 0x0800, 2); // drapeau : noms en UTF-8
    ecrireEntier(vue, position + 8, 0, 2); // méthode : stored
    ecrireEntier(vue, position + 10, 0, 2); // heure
    ecrireEntier(vue, position + 12, 0, 2); // date
    ecrireEntier(vue, position + 14, entree.crc, 4);
    ecrireEntier(vue, position + 18, entree.contenu.length, 4); // taille compressée
    ecrireEntier(vue, position + 22, entree.contenu.length, 4); // taille réelle
    ecrireEntier(vue, position + 26, entree.nom.length, 2);
    ecrireEntier(vue, position + 28, 0, 2); // pas de champ supplémentaire
    sortie.set(entree.nom, position + 30);
    sortie.set(entree.contenu, position + 30 + entree.nom.length);
    position += 30 + entree.nom.length + entree.contenu.length;
  }

  const debutCentral = position;
  for (let i = 0; i < entrees.length; i += 1) {
    const entree = entrees[i]!;
    ecrireEntier(vue, position, 0x02014b50, 4); // signature d'en-tête central
    ecrireEntier(vue, position + 4, 20, 2); // version d'écriture
    ecrireEntier(vue, position + 6, 20, 2); // version minimale
    ecrireEntier(vue, position + 8, 0x0800, 2);
    ecrireEntier(vue, position + 10, 0, 2);
    ecrireEntier(vue, position + 12, 0, 2);
    ecrireEntier(vue, position + 14, 0, 2);
    ecrireEntier(vue, position + 16, entree.crc, 4);
    ecrireEntier(vue, position + 20, entree.contenu.length, 4);
    ecrireEntier(vue, position + 24, entree.contenu.length, 4);
    ecrireEntier(vue, position + 28, entree.nom.length, 2);
    ecrireEntier(vue, position + 30, 0, 2); // champ supplémentaire
    ecrireEntier(vue, position + 32, 0, 2); // commentaire
    ecrireEntier(vue, position + 34, 0, 2); // numéro de disque
    ecrireEntier(vue, position + 36, 0, 2); // attributs internes
    ecrireEntier(vue, position + 38, 0, 4); // attributs externes
    ecrireEntier(vue, position + 42, decalages[i]!, 4);
    sortie.set(entree.nom, position + 46);
    position += 46 + entree.nom.length;
  }

  ecrireEntier(vue, position, 0x06054b50, 4); // fin du répertoire central
  ecrireEntier(vue, position + 4, 0, 2);
  ecrireEntier(vue, position + 6, 0, 2);
  ecrireEntier(vue, position + 8, entrees.length, 2);
  ecrireEntier(vue, position + 10, entrees.length, 2);
  ecrireEntier(vue, position + 12, position - debutCentral, 4);
  ecrireEntier(vue, position + 16, debutCentral, 4);
  ecrireEntier(vue, position + 20, 0, 2); // longueur du commentaire

  return sortie;
}

import { describe, it, expect } from 'vitest';
import { crc32, nomFichierSur, construireZip } from '../zip';

/**
 * L'oracle est extérieur au code testé : les CRC de référence viennent de la
 * littérature (vecteurs classiques du CRC-32 ZIP), pas de notre propre
 * implémentation. Le format lui-même est vérifié octet par octet contre la
 * spécification, et l'archive produite est réellement ouverte par un outil
 * tiers dans `scripts/verifier-zip.ts`.
 */
describe('crc32', () => {
  const encode = (s: string) => new TextEncoder().encode(s);

  it('reproduit les vecteurs de référence', () => {
    expect(crc32(encode(''))).toBe(0);
    expect(crc32(encode('a'))).toBe(0xe8b7be43);
    expect(crc32(encode('abc'))).toBe(0x352441c2);
    expect(crc32(encode('hello'))).toBe(0x3610a686);
    expect(crc32(encode('123456789'))).toBe(0xcbf43926);
  });

  it('reste dans les entiers non signés 32 bits', () => {
    const grand = crc32(encode('The quick brown fox jumps over the lazy dog'));
    expect(grand).toBe(0x414fa339);
    expect(grand).toBeGreaterThanOrEqual(0);
  });
});

describe('nomFichierSur', () => {
  it('neutralise les séparateurs de chemin', () => {
    // Un nom d'élève mal saisi (« KOFFI/AGBO ») créerait un sous-dossier à
    // l'extraction, voire sortirait du dossier cible.
    expect(nomFichierSur('KOFFI/AGBO Yao.pdf')).toBe('KOFFI-AGBO Yao.pdf');
    expect(nomFichierSur('..\\..\\systeme.pdf')).toBe('..-..-systeme.pdf');
  });

  it('retire les caractères interdits par Windows', () => {
    expect(nomFichierSur('Bulletin: 3e <D>.pdf')).toBe('Bulletin- 3e -D-.pdf');
  });

  it('conserve les accents, qui sont légaux', () => {
    expect(nomFichierSur('Éléonore ADJÉ.pdf')).toBe('Éléonore ADJÉ.pdf');
  });

  it('ne renvoie jamais une chaîne vide', () => {
    expect(nomFichierSur('   ')).toBe('document');
    expect(nomFichierSur('///')).toBe('---');
  });
});

describe('construireZip', () => {
  const encode = (s: string) => new TextEncoder().encode(s);

  it('produit une archive vide valide', () => {
    const zip = construireZip([]);
    // Une archive vide, c'est le seul enregistrement de fin : 22 octets.
    expect(zip.length).toBe(22);
    expect(new DataView(zip.buffer).getUint32(0, true)).toBe(0x06054b50);
  });

  it('pose les signatures aux bons endroits', () => {
    const zip = construireZip([{ nom: 'a.txt', contenu: encode('abc') }]);
    const vue = new DataView(zip.buffer);
    expect(vue.getUint32(0, true)).toBe(0x04034b50); // en-tête local
    // 30 octets d'en-tête + 5 de nom + 3 de contenu.
    expect(vue.getUint32(38, true)).toBe(0x02014b50); // en-tête central
    expect(vue.getUint32(38 + 46 + 5, true)).toBe(0x06054b50); // fin
  });

  it('écrit le CRC et les deux tailles de chaque entrée', () => {
    const contenu = encode('123456789');
    const zip = construireZip([{ nom: 'x', contenu }]);
    const vue = new DataView(zip.buffer);
    expect(vue.getUint32(14, true)).toBe(0xcbf43926);
    expect(vue.getUint32(18, true)).toBe(contenu.length); // taille compressée
    expect(vue.getUint32(22, true)).toBe(contenu.length); // taille réelle
  });

  it('déclare la méthode « stored » et le drapeau UTF-8', () => {
    // Sans le drapeau, un prénom accentué ressort en mojibake sous Windows.
    const zip = construireZip([{ nom: 'é.txt', contenu: encode('x') }]);
    const vue = new DataView(zip.buffer);
    expect(vue.getUint16(6, true)).toBe(0x0800);
    expect(vue.getUint16(8, true)).toBe(0); // 0 = stored, pas de compression
  });

  it('annonce le bon nombre d’entrées et le bon décalage central', () => {
    const fichiers = [
      { nom: 'un.pdf', contenu: encode('aaa') },
      { nom: 'deux.pdf', contenu: encode('bbbb') },
      { nom: 'trois.pdf', contenu: encode('ccccc') },
    ];
    const zip = construireZip(fichiers);
    const fin = zip.length - 22;
    const vue = new DataView(zip.buffer);
    expect(vue.getUint16(fin + 8, true)).toBe(3);
    expect(vue.getUint16(fin + 10, true)).toBe(3);

    const tailleLocale = fichiers.reduce(
      (s, f) => s + 30 + new TextEncoder().encode(f.nom).length + f.contenu.length,
      0,
    );
    expect(vue.getUint32(fin + 16, true)).toBe(tailleLocale); // début du central
    expect(vue.getUint32(fin + 12, true)).toBe(fin - tailleLocale); // sa taille
  });

  it('conserve le contenu exact de chaque fichier', () => {
    const contenu = encode('bulletin');
    const zip = construireZip([{ nom: 'b.pdf', contenu }]);
    const debut = 30 + 'b.pdf'.length;
    expect(Array.from(zip.slice(debut, debut + contenu.length))).toEqual(Array.from(contenu));
  });
});

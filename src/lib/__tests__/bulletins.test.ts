import { describe, it, expect } from 'vitest';
import {
  bulletinsCourantsParEleve,
  bulletinsATelecharger,
  nomFichierBulletin,
  libellePeriode,
  type DocumentBulletin,
} from '../bulletins';

/** Les documents arrivent toujours tries du plus recent au plus ancien. */
function doc(
  id: string,
  eleveId: string,
  date: string,
  statut = 'GENERE',
): DocumentBulletin {
  return { documentId: id, reference: `BUL-${id}`, dateGeneration: date, statut, eleveId };
}

describe('bulletinsATelecharger', () => {
  it('ne rend qu’un bulletin par élève', () => {
    // Oracle : trois documents, deux élèves, donc deux fichiers. C'est le
    // défaut signalé — le dossier se remplissait des trois.
    const documents = [
      doc('c', 'eleve-1', '2026-09-03'),
      doc('b', 'eleve-1', '2026-09-02'),
      doc('a', 'eleve-2', '2026-09-01'),
    ];
    const resultat = bulletinsATelecharger(documents);
    expect(resultat).toHaveLength(2);
    expect(resultat.map((d) => d.documentId).sort()).toEqual(['a', 'c']);
  });

  it('garde le plus récent même quand tous sont en GENERE', () => {
    // Le cas reel : la generation groupee empilait des documents tous en
    // `GENERE`. Se fier au seul statut laissait passer les cinq.
    const documents = [
      doc('recent', 'eleve-1', '2026-09-04'),
      doc('moyen', 'eleve-1', '2026-09-03'),
      doc('vieux', 'eleve-1', '2026-09-02'),
    ];
    expect(bulletinsATelecharger(documents).map((d) => d.documentId)).toEqual(['recent']);
  });

  it('ignore un élève dont toutes les versions sont obsolètes', () => {
    // Un bulletin annule ne doit pas ressortir « faute de mieux » : mieux vaut
    // aucun fichier qu'un document que quelqu'un a explicitement perime.
    const documents = [doc('x', 'eleve-1', '2026-09-01', 'OBSOLETE')];
    expect(bulletinsATelecharger(documents)).toEqual([]);
  });

  it('ne rend rien quand aucun bulletin n’existe', () => {
    expect(bulletinsATelecharger([])).toEqual([]);
  });
});

describe('bulletinsCourantsParEleve', () => {
  it('compte les versions remplacées sans les confondre avec le courant', () => {
    const documents = [
      doc('c', 'eleve-1', '2026-09-03'),
      doc('b', 'eleve-1', '2026-09-02'),
      doc('a', 'eleve-1', '2026-09-01', 'OBSOLETE'),
    ];
    const etat = bulletinsCourantsParEleve(documents).get('eleve-1')!;
    expect(etat.courant?.documentId).toBe('c');
    expect(etat.remplacees).toBe(2);
  });

  it('donne le même courant que ce qui est téléchargé', () => {
    // Les deux lecteurs partagent la regle : l'ecran annoncait un bulletin et
    // le telechargement en sortait trois. Ce test verrouille leur accord.
    const documents = [
      doc('c', 'eleve-1', '2026-09-03'),
      doc('b', 'eleve-1', '2026-09-02'),
      doc('a', 'eleve-2', '2026-09-01'),
    ];
    const courants = bulletinsATelecharger(documents).map((d) => d.documentId).sort();
    const parEleve = [...bulletinsCourantsParEleve(documents).values()]
      .map((e) => e.courant?.documentId)
      .filter(Boolean)
      .sort();
    expect(courants).toEqual(parEleve);
  });
});

describe('nomFichierBulletin', () => {
  it('nomme par élève et période, pas par référence de document', () => {
    // « KOFFI Yao - BUL-2026-0042.pdf » ne disait ni de quel trimestre il
    // s'agissait ni laquelle des versions c'etait.
    expect(nomFichierBulletin('KOFFI Yao', 'MAT-2026-0031', 'TRIMESTRE_1')).toBe(
      'KOFFI Yao - MAT-2026-0031 - Trimestre 1.pdf',
    );
  });

  it('distingue deux homonymes par leur matricule', () => {
    // Sans le matricule, le second ecraserait silencieusement le premier dans
    // le dossier choisi — une perte de fichier que rien ne signalerait.
    const a = nomFichierBulletin('KOFFI Yao', 'MAT-0001', 'TRIMESTRE_1');
    const b = nomFichierBulletin('KOFFI Yao', 'MAT-0002', 'TRIMESTRE_1');
    expect(a).not.toBe(b);
  });

  it('reste lisible sans matricule', () => {
    expect(nomFichierBulletin('KOFFI Yao', null, 'TRIMESTRE_2')).toBe(
      'KOFFI Yao - Trimestre 2.pdf',
    );
  });

  it('ne laisse pas fuiter un libellé technique', () => {
    expect(libellePeriode('TRIMESTRE_3')).toBe('Trimestre 3');
    expect(nomFichierBulletin('A B', null, 'TRIMESTRE_3')).not.toContain('TRIMESTRE_');
  });
});

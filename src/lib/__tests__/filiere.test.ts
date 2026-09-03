import { describe, it, expect } from 'vitest';
import {
  cleCombinaison,
  libelleCombinaison,
  combinaisonsEnseignees,
  type ClasseOuverte,
  type NiveauOrdonne,
} from '../filiere';

const NIVEAUX: NiveauOrdonne[] = [
  { id: 'n-6e', nom: '6ème', ordre: 1, cycleOrdre: 3 },
  { id: 'n-2nde', nom: 'Seconde', ordre: 1, cycleOrdre: 4 },
  { id: 'n-1ere', nom: 'Première', ordre: 2, cycleOrdre: 4 },
];

describe('libelleCombinaison', () => {
  it('accole la série au niveau', () => {
    expect(libelleCombinaison('Seconde', 'C')).toBe('Seconde C');
  });

  it('laisse le niveau seul quand il n’y a pas de filière', () => {
    // Tout le collège : accoler un tiret ou des parenthèses vides donnerait
    // « 6ème () », ce qui se lit comme une donnée manquante.
    expect(libelleCombinaison('6ème', null)).toBe('6ème');
  });
});

describe('cleCombinaison', () => {
  it('distingue deux filières du même niveau', () => {
    expect(cleCombinaison('n-2nde', 's-c')).not.toBe(cleCombinaison('n-2nde', 's-d'));
  });

  it('n’écrit jamais la chaîne « null » pour l’absence de série', () => {
    // Cette clé traverse la frontière serveur/client dans un enregistrement :
    // « null » finirait par être confondu avec un identifiant.
    expect(cleCombinaison('n-6e', null)).toBe('n-6e|');
  });
});

describe('combinaisonsEnseignees', () => {
  it('déduit les filières des classes ouvertes, sans doublon', () => {
    // Trois Terminale D ne font qu'un programme : la décision se prend par
    // filière, pas par classe.
    const classes: ClasseOuverte[] = [
      { niveauId: 'n-2nde', serieId: 's-c', serieNom: 'C' },
      { niveauId: 'n-2nde', serieId: 's-c', serieNom: 'C' },
      { niveauId: 'n-2nde', serieId: 's-a4', serieNom: 'A4' },
    ];
    const resultat = combinaisonsEnseignees(classes, NIVEAUX);
    expect(resultat.map((c) => c.libelle)).toEqual(['Seconde A4', 'Seconde C']);
  });

  it('sépare les filières d’un même niveau au lieu de les confondre', () => {
    // C'est le défaut corrigé : l'étape « programme » affichait « Seconde »
    // une seule fois et appliquait la même liste de matières aux trois
    // filières.
    const classes: ClasseOuverte[] = [
      { niveauId: 'n-2nde', serieId: 's-a4', serieNom: 'A4' },
      { niveauId: 'n-2nde', serieId: 's-c', serieNom: 'C' },
      { niveauId: 'n-2nde', serieId: 's-d', serieNom: 'D' },
    ];
    expect(combinaisonsEnseignees(classes, NIVEAUX)).toHaveLength(3);
  });

  it('garde un niveau sans série tel quel', () => {
    const classes: ClasseOuverte[] = [{ niveauId: 'n-6e', serieId: null, serieNom: null }];
    const [combinaison] = combinaisonsEnseignees(classes, NIVEAUX);
    expect(combinaison!.libelle).toBe('6ème');
    expect(combinaison!.serieId).toBeNull();
  });

  it('ordonne par cursus, puis par série', () => {
    const classes: ClasseOuverte[] = [
      { niveauId: 'n-1ere', serieId: 's-d', serieNom: 'D' },
      { niveauId: 'n-2nde', serieId: 's-c', serieNom: 'C' },
      { niveauId: 'n-6e', serieId: null, serieNom: null },
      { niveauId: 'n-2nde', serieId: 's-a4', serieNom: 'A4' },
    ];
    expect(combinaisonsEnseignees(classes, NIVEAUX).map((c) => c.libelle)).toEqual([
      '6ème',
      'Seconde A4',
      'Seconde C',
      'Première D',
    ]);
  });

  it('n’invente aucune filière qui n’a pas de classe', () => {
    // Le périmètre d'une école ne se déduit que de ses classes : proposer les
    // onze séries du catalogue noierait l'écran sous des filières qu'elle
    // n'ouvre pas.
    const classes: ClasseOuverte[] = [{ niveauId: 'n-2nde', serieId: 's-c', serieNom: 'C' }];
    expect(combinaisonsEnseignees(classes, NIVEAUX)).toHaveLength(1);
  });

  it('ignore une classe posée sur un niveau hors catalogue', () => {
    // Un cycle retiré du catalogue (primaire depuis 0014) ne doit pas faire
    // disparaître les autres filières de l'écran.
    const classes: ClasseOuverte[] = [
      { niveauId: 'n-cm2', serieId: null, serieNom: null },
      { niveauId: 'n-6e', serieId: null, serieNom: null },
    ];
    expect(combinaisonsEnseignees(classes, NIVEAUX).map((c) => c.libelle)).toEqual(['6ème']);
  });

  it('ne renvoie rien tant qu’aucune classe n’existe', () => {
    expect(combinaisonsEnseignees([], NIVEAUX)).toEqual([]);
  });
});

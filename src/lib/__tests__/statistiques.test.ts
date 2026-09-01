import { describe, it, expect } from 'vitest';
import { agregerStatistiques, SEUIL_REUSSITE, type EleveEvalue } from '../statistiques';

const CLASSES = [
  { id: 'c1', nom: '6ème A', niveauNom: '6ème' },
  { id: 'c2', nom: '5ème A', niveauNom: '5ème' },
];

function eleve(p: Partial<EleveEvalue> & { eleveId: string }): EleveEvalue {
  return {
    classeId: 'c1',
    classeNom: '6ème A',
    niveauNom: '6ème',
    sexe: 'M',
    moyenne: null,
    matieres: [],
    ...p,
  };
}

describe('agregerStatistiques', () => {
  it('ignore les eleves sans moyenne au lieu de les compter zero', () => {
    // Le point du test : compter un eleve non note comme zero ferait plonger
    // la moyenne d'une classe dont les notes ne sont pas encore saisies, et
    // donnerait l'alerte en debut de trimestre, quand il n'y a rien a alerter.
    const s = agregerStatistiques(
      [
        eleve({ eleveId: 'a', moyenne: 14 }),
        eleve({ eleveId: 'b', moyenne: null }),
        eleve({ eleveId: 'c', moyenne: 16 }),
      ],
      CLASSES,
    );
    expect(s.moyenneGenerale).toBe(15);
    expect(s.effectifEvalue).toBe(2);
    expect(s.effectifTotal).toBe(3);
  });

  it('rend null plutot que zero quand personne n est evalue', () => {
    // Zero est une note ; l'absence de note n'en est pas une.
    const s = agregerStatistiques([eleve({ eleveId: 'a' })], CLASSES);
    expect(s.moyenneGenerale).toBeNull();
    expect(s.tauxReussite).toBeNull();
    expect(s.classes[0]!.moyenne).toBeNull();
  });

  it('fait figurer une classe sans aucun eleve evalue', () => {
    // Son absence se lirait comme une omission, alors qu'elle est une
    // information : personne n'y a saisi de notes.
    const s = agregerStatistiques([eleve({ eleveId: 'a', moyenne: 12 })], CLASSES);
    expect(s.classes).toHaveLength(2);
    const c2 = s.classes.find((c) => c.id === 'c2')!;
    expect(c2.effectif).toBe(0);
    expect(c2.moyenne).toBeNull();
  });

  it('compte comme reussite une moyenne exactement au seuil', () => {
    const s = agregerStatistiques(
      [
        eleve({ eleveId: 'a', moyenne: SEUIL_REUSSITE }),
        eleve({ eleveId: 'b', moyenne: SEUIL_REUSSITE - 0.01 }),
      ],
      CLASSES,
    );
    expect(s.tauxReussite).toBe(50);
  });

  it('situe chaque matiere par son ecart a la moyenne generale', () => {
    // 9,5 est faible dans un etablissement a 13, banal dans un a 9 : la
    // moyenne brute seule ne le dit pas.
    const s = agregerStatistiques(
      [
        eleve({
          eleveId: 'a',
          moyenne: 12,
          matieres: [
            { matiereId: 'm1', matiereNom: 'Maths', moyenne: 8 },
            { matiereId: 'm2', matiereNom: 'Français', moyenne: 16 },
          ],
        }),
      ],
      CLASSES,
    );
    const maths = s.matieres.find((m) => m.id === 'm1')!;
    const francais = s.matieres.find((m) => m.id === 'm2')!;
    expect(maths.ecart).toBe(-4);
    expect(francais.ecart).toBe(4);
    // Les matieres les plus faibles d'abord : ce sont celles qu'on cherche.
    expect(s.matieres[0]!.id).toBe('m1');
  });

  it('ignore une matiere non notee sans fausser les autres', () => {
    const s = agregerStatistiques(
      [
        eleve({
          eleveId: 'a',
          moyenne: 10,
          matieres: [
            { matiereId: 'm1', matiereNom: 'Maths', moyenne: 10 },
            { matiereId: 'm2', matiereNom: 'EPS', moyenne: null },
          ],
        }),
      ],
      CLASSES,
    );
    expect(s.matieres).toHaveLength(1);
    expect(s.matieres[0]!.libelle).toBe('Maths');
  });

  it('rend toujours les deux sexes, meme absent', () => {
    // Une repartition qui masque un groupe vide laisse croire a un oubli.
    const s = agregerStatistiques([eleve({ eleveId: 'a', sexe: 'M', moyenne: 11 })], CLASSES);
    expect(s.parSexe.map((x) => x.libelle)).toEqual(['Filles', 'Garçons']);
    const filles = s.parSexe.find((x) => x.id === 'F')!;
    expect(filles.effectif).toBe(0);
    expect(filles.moyenne).toBeNull();
  });

  it('range chaque moyenne dans une seule tranche, bornes comprises', () => {
    const s = agregerStatistiques(
      [
        eleve({ eleveId: 'a', moyenne: 0 }),
        eleve({ eleveId: 'b', moyenne: 7.99 }),
        eleve({ eleveId: 'c', moyenne: 8 }),
        eleve({ eleveId: 'd', moyenne: 10 }),
        eleve({ eleveId: 'e', moyenne: 20 }),
      ],
      CLASSES,
    );
    const total = s.distribution.reduce((t, d) => t + d.effectif, 0);
    expect(total).toBe(5);
    expect(s.distribution[0]!.effectif).toBe(2); // 0 et 7,99
    expect(s.distribution[1]!.effectif).toBe(1); // 8
    expect(s.distribution[2]!.effectif).toBe(1); // 10
    expect(s.distribution.at(-1)!.effectif).toBe(1); // 20, borne haute incluse
  });

  it('survit a un etablissement sans aucune classe', () => {
    const s = agregerStatistiques([], []);
    expect(s.classes).toEqual([]);
    expect(s.matieres).toEqual([]);
    expect(s.moyenneGenerale).toBeNull();
    expect(s.effectifTotal).toBe(0);
  });
});

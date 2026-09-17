/**
 * Un mauvais rapprochement coûte plus cher qu'une saisie à la main : il
 * attribue l'emploi du temps et les professeurs d'une classe à une autre, et
 * l'erreur ne se voit qu'à la première heure de cours. Ces tests portent donc
 * autant sur ce qui est **refusé** que sur ce qui est rapproché.
 */
import { describe, expect, it } from 'vitest';
import {
  apparierClasses,
  propositionsTarifs,
  type ClasseAApparier,
  type TarifSource,
} from '../reconduction';

const SIXIEME = 'niveau-6';
const CINQUIEME = 'niveau-5';
const SERIE_D = 'serie-d';

function classe(
  id: string,
  nom: string,
  niveauId = SIXIEME,
  serieId: string | null = null,
): ClasseAApparier {
  return { id, nom, niveauId, serieId };
}

describe('apparierClasses', () => {
  it('rapproche par le nom quand il est identique', () => {
    const { paires, orphelines } = apparierClasses(
      [classe('s1', '6ème A'), classe('s2', '6ème B')],
      [classe('c1', '6ème A'), classe('c2', '6ème B')],
    );
    expect(orphelines).toHaveLength(0);
    expect(paires).toHaveLength(2);
    expect(paires.every((p) => p.motif === 'NOM')).toBe(true);
    expect(paires.find((p) => p.cible.id === 'c1')?.source.id).toBe('s1');
  });

  it('ignore accents, casse et espaces en trop', () => {
    const { paires } = apparierClasses([classe('s1', '6ème  A')], [classe('c1', '6EME a')]);
    expect(paires).toHaveLength(1);
    expect(paires[0]?.motif).toBe('NOM');
  });

  it('rapproche la seule candidate restante, ce qui couvre un renommage', () => {
    const { paires, orphelines } = apparierClasses(
      [classe('s1', '6ème A')],
      [classe('c1', '6ème 1')],
    );
    expect(orphelines).toHaveLength(0);
    expect(paires[0]?.motif).toBe('SEULE_CANDIDATE');
    expect(paires[0]?.source.id).toBe('s1');
  });

  /**
   * Le cas qui justifie tout le fichier. Trois classes renommées face à trois
   * sources : n'importe quel rapprochement serait un pari, et se tromper
   * donnerait l'emploi du temps de la 6ème A à la 6ème C.
   */
  it('refuse de deviner quand plusieurs candidates restent de chaque côté', () => {
    const { paires, orphelines } = apparierClasses(
      [classe('s1', '6ème A'), classe('s2', '6ème B'), classe('s3', '6ème C')],
      [classe('c1', '6ème 1'), classe('c2', '6ème 2'), classe('c3', '6ème 3')],
    );
    expect(paires).toHaveLength(0);
    expect(orphelines.map((o) => o.id)).toEqual(['c1', 'c2', 'c3']);
  });

  it('ne rapproche jamais deux niveaux différents', () => {
    const { paires, orphelines } = apparierClasses(
      [classe('s1', 'A', SIXIEME)],
      [classe('c1', 'A', CINQUIEME)],
    );
    expect(paires).toHaveLength(0);
    expect(orphelines.map((o) => o.id)).toEqual(['c1']);
  });

  it('ne rapproche jamais deux séries différentes', () => {
    const { paires, orphelines } = apparierClasses(
      [classe('s1', 'Tle', 'niveau-tle', SERIE_D)],
      [classe('c1', 'Tle', 'niveau-tle', null)],
    );
    expect(paires).toHaveLength(0);
    expect(orphelines).toHaveLength(1);
  });

  it('laisse orpheline une classe nouvellement ouverte', () => {
    const { paires, orphelines } = apparierClasses(
      [classe('s1', '6ème A')],
      [classe('c1', '6ème A'), classe('c2', '6ème B')],
    );
    expect(paires).toHaveLength(1);
    expect(orphelines.map((o) => o.id)).toEqual(['c2']);
  });

  it("n'utilise jamais deux fois la même classe source", () => {
    const { paires } = apparierClasses(
      [classe('s1', '6ème A')],
      [classe('c1', '6ème A'), classe('c2', '6ème A')],
    );
    expect(paires).toHaveLength(1);
    expect(paires[0]?.source.id).toBe('s1');
  });
});

function tarif(montant: number, typeFraisId = 'f1', niveauId = SIXIEME): TarifSource {
  return { niveauId, serieId: null, typeFraisId, typeFraisNom: 'Scolarité', montant };
}

describe('propositionsTarifs', () => {
  it('propose le montant du niveau à toutes ses classes', () => {
    const { propositions, conflits } = propositionsTarifs(
      [tarif(65000), tarif(65000)],
      [classe('c1', '6ème A'), classe('c2', '6ème B')],
    );
    expect(conflits).toHaveLength(0);
    expect(propositions).toHaveLength(2);
    expect(propositions.every((p) => p.montant === 65000)).toBe(true);
    expect(propositions.map((p) => p.classeCibleId).sort()).toEqual(['c1', 'c2']);
  });

  it('propose chaque type de frais séparément', () => {
    const { propositions } = propositionsTarifs(
      [tarif(65000, 'scolarite'), tarif(15000, 'tenue')],
      [classe('c1', '6ème A')],
    );
    expect(propositions).toHaveLength(2);
    expect(propositions.map((p) => p.montant).sort((a, b) => a - b)).toEqual([15000, 65000]);
  });

  /**
   * Un prix que personne n'a décidé est pire qu'un champ vide : le champ vide
   * se voit, le prix plausible se facture.
   */
  it('ne propose rien quand le niveau portait deux montants, et nomme le conflit', () => {
    const { propositions, conflits } = propositionsTarifs(
      [tarif(65000), tarif(70000)],
      [classe('c1', '6ème A')],
    );
    expect(propositions).toHaveLength(0);
    expect(conflits).toHaveLength(1);
    expect(conflits[0]?.montants).toEqual([65000, 70000]);
    expect(conflits[0]?.typeFraisNom).toBe('Scolarité');
  });

  it('ne signale un conflit qu une seule fois, quel que soit le nombre de classes', () => {
    const { conflits } = propositionsTarifs(
      [tarif(65000), tarif(70000)],
      [classe('c1', '6ème A'), classe('c2', '6ème B'), classe('c3', '6ème C')],
    );
    expect(conflits).toHaveLength(1);
  });

  it('ne propose rien pour un niveau absent de l année source', () => {
    const { propositions, conflits } = propositionsTarifs(
      [tarif(65000, 'f1', SIXIEME)],
      [classe('c1', '5ème A', CINQUIEME)],
    );
    expect(propositions).toHaveLength(0);
    expect(conflits).toHaveLength(0);
  });

  it('distingue les séries : la Tle D ne prend pas le tarif de la Tle sans série', () => {
    const source: TarifSource[] = [
      { niveauId: 'tle', serieId: null, typeFraisId: 'f1', typeFraisNom: 'Scolarité', montant: 80000 },
    ];
    const { propositions } = propositionsTarifs(source, [classe('c1', 'Tle D', 'tle', SERIE_D)]);
    expect(propositions).toHaveLength(0);
  });
});

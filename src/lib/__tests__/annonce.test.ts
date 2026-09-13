import { describe, it, expect } from 'vitest';
import { annonceConcerneEcole, MAX_ANNONCES_AFFICHEES } from '../annonce';

const COLLEGE = 'b1f0d6c4-0000-4000-8000-000000000001';
const LYCEE = 'b1f0d6c4-0000-4000-8000-000000000002';

describe('portée d\u2019une annonce', () => {
  it('sans cycle, elle s\u2019adresse à toutes les écoles', () => {
    expect(annonceConcerneEcole({ cycleId: null }, [])).toBe(true);
    expect(annonceConcerneEcole({ cycleId: null }, [COLLEGE])).toBe(true);
  });

  it('avec un cycle, seules les écoles qui l\u2019enseignent la voient', () => {
    expect(annonceConcerneEcole({ cycleId: LYCEE }, [COLLEGE, LYCEE])).toBe(true);
    expect(annonceConcerneEcole({ cycleId: LYCEE }, [COLLEGE])).toBe(false);
  });

  /**
   * Le sens du refus. Quand les cycles n'ont pas pu être lus, la liste arrive
   * vide : une annonce ciblée se tait alors, plutôt que de s'afficher au
   * hasard. « Les épreuves du BAC commencent lundi » servi à un collège coûte
   * la crédibilité de toutes les annonces suivantes.
   */
  it('se tait quand les cycles de l\u2019école sont inconnus', () => {
    expect(annonceConcerneEcole({ cycleId: LYCEE }, [])).toBe(false);
  });

  it('n\u2019affiche jamais plus de deux annonces à la fois', () => {
    // Le bandeau d'abonnement peut déjà en occuper un ; au-delà, la page
    // commence sous la ligne de flottaison sur un téléphone.
    expect(MAX_ANNONCES_AFFICHEES).toBe(2);
  });
});

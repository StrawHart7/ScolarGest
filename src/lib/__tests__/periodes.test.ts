import { describe, it, expect } from 'vitest';
import {
  periodesDuRegime,
  phrasePeriode,
  motPeriode,
  TOUTES_PERIODES,
  PERIODES_ORDONNEES,
  REGIME_PAR_DEFAUT,
} from '../periodes';
import { moyenneAnnuelle } from '@/modules/academics/services/calcul-moyennes';
import { periodeLabel } from '@/lib/pdf/templates/bulletin';

/**
 * Trimestre ou semestre.
 *
 * Le pari de cette fonctionnalité est qu'un semestre **n'est pas une nouvelle
 * donnée** : `TRIMESTRE_1` et `TRIMESTRE_2` servent aux deux régimes, seul
 * l'affichage change. Ces tests gardent ce pari — le jour où quelqu'un
 * ajouterait `SEMESTRE_1` à l'énumération, ils diraient ce qui se casse.
 */
describe('périodes proposées', () => {
  it('trois au trimestre, deux au semestre', () => {
    expect(periodesDuRegime('TRIMESTRE')).toEqual([
      'TRIMESTRE_1',
      'TRIMESTRE_2',
      'TRIMESTRE_3',
    ]);
    expect(periodesDuRegime('SEMESTRE')).toEqual(['TRIMESTRE_1', 'TRIMESTRE_2']);
  });

  it('ne propose jamais la troisième à une école au semestre', () => {
    // C'est **le** point de la fonctionnalité : un écran qui l'oublierait
    // offrirait un trimestre que l'école n'aura jamais.
    expect(periodesDuRegime('SEMESTRE')).not.toContain('TRIMESTRE_3');
  });

  it('retombe sur le trimestre sans régime — le cas de toutes les écoles en base', () => {
    expect(periodesDuRegime()).toEqual(periodesDuRegime('TRIMESTRE'));
    expect(REGIME_PAR_DEFAUT).toBe('TRIMESTRE');
    expect(PERIODES_ORDONNEES).toEqual(periodesDuRegime('TRIMESTRE'));
  });

  it('garde les trois clés pour balayer des données existantes', () => {
    // Chercher la dernière période notée doit regarder les trois, même dans
    // une école au semestre : des notes peuvent y traîner d'un régime
    // précédent, et les ignorer ferait disparaître des moyennes.
    expect(TOUTES_PERIODES).toHaveLength(3);
  });
});

describe('libellés', () => {
  it('dit trimestre ou semestre selon le régime', () => {
    expect(phrasePeriode('TRIMESTRE_1', 'TRIMESTRE')).toBe('1er trimestre');
    expect(phrasePeriode('TRIMESTRE_1', 'SEMESTRE')).toBe('1er semestre');
    expect(phrasePeriode('TRIMESTRE_2', 'SEMESTRE')).toBe('2e semestre');
    expect(motPeriode('SEMESTRE')).toBe('semestre');
    expect(motPeriode()).toBe('trimestre');
  });

  it('nomme quand même la troisième en régime semestriel', () => {
    // Jamais employée, mais une donnée héritée d'un changement de régime doit
    // rester lisible plutôt que s'afficher en clé brute sur un bulletin.
    expect(phrasePeriode('TRIMESTRE_3', 'SEMESTRE')).not.toContain('TRIMESTRE_3');
  });

  it('imprime le bon mot sur le bulletin', () => {
    expect(periodeLabel('TRIMESTRE_1', 'TRIMESTRE')).toBe('1er Trimestre');
    expect(periodeLabel('TRIMESTRE_1', 'SEMESTRE')).toBe('1er Semestre');
    // Sans régime : le comportement d'avant, pour tout le code déjà écrit.
    expect(periodeLabel('TRIMESTRE_1')).toBe('1er Trimestre');
  });
});

describe('le moteur n’a rien à corriger', () => {
  it('une école au semestre a sa moyenne annuelle sur deux périodes', () => {
    // C'est ce qui permet de ne pas toucher au calcul : `moyenneAnnuelle`
    // écarte déjà les périodes nulles avant de diviser — corrigé le
    // 2026-09-02, après le bulletin qui affichait 4,11 pour un élève à 12,33.
    // La troisième période d'une école au semestre est toujours nulle.
    expect(moyenneAnnuelle(12, 14, null)).toBe(13);
    expect(moyenneAnnuelle(12, 14, 10)).toBe(12);
  });

  it('ne compte pas une période absente comme un zéro', () => {
    expect(moyenneAnnuelle(12, null, null)).toBe(12);
    expect(moyenneAnnuelle(null, null, null)).toBeNull();
  });
});

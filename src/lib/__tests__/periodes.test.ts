import { describe, it, expect } from 'vitest';
import {
  periodesDuRegime,
  phrasePeriode,
  motPeriode,
  regimeDuCycle,
  regimeDominant,
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

/**
 * Le découpage appartient au lycée, pas à l'école.
 *
 * Règle posée par l'utilisateur le 2026-09-15 : « le régime semestriel, c'est
 * seulement au lycée que c'est possible. Au collège, c'est toujours et toujours
 * le régime trimestriel. » Elle remplace celle de la veille — « toute l'école à
 * l'un ou à l'autre » — que ces tests auraient laissé passer.
 */
describe('le régime suit le cycle de la classe', () => {
  it('le collège reste au trimestre même quand le lycée est au semestre', () => {
    // Le cœur de la règle. Un complexe porte donc les deux découpages.
    expect(regimeDuCycle('COLLEGE', 'SEMESTRE')).toBe('TRIMESTRE');
    expect(regimeDuCycle('LYCEE', 'SEMESTRE')).toBe('SEMESTRE');
  });

  it('donne trois périodes à une 6e dans une école dont le lycée est au semestre', () => {
    // Formulé en périodes et non en régime : c'est ce que l'écran affiche, et
    // c'est là que le défaut se verrait.
    expect(periodesDuRegime(regimeDuCycle('COLLEGE', 'SEMESTRE'))).toHaveLength(3);
    expect(periodesDuRegime(regimeDuCycle('LYCEE', 'SEMESTRE'))).toHaveLength(2);
  });

  it('nomme la même clé différemment selon le cycle, dans la même école', () => {
    expect(phrasePeriode('TRIMESTRE_2', regimeDuCycle('COLLEGE', 'SEMESTRE'))).toBe('2e trimestre');
    expect(phrasePeriode('TRIMESTRE_2', regimeDuCycle('LYCEE', 'SEMESTRE'))).toBe('2e semestre');
  });

  it('retombe sur le trimestre quand le cycle est inconnu ou absent', () => {
    // Se tromper dans ce sens montre une période de trop, vide. Se tromper dans
    // l'autre cacherait un trimestre déjà noté, compté dans la moyenne annuelle
    // sans qu'aucun écran ne le montre.
    expect(regimeDuCycle(null, 'SEMESTRE')).toBe('TRIMESTRE');
    expect(regimeDuCycle(undefined, 'SEMESTRE')).toBe('TRIMESTRE');
    expect(regimeDuCycle('PRIMAIRE', 'SEMESTRE')).toBe('TRIMESTRE');
  });

  it('laisse le collège au trimestre même si le lycée y est aussi', () => {
    expect(regimeDuCycle('COLLEGE', 'TRIMESTRE')).toBe('TRIMESTRE');
    expect(regimeDuCycle('LYCEE', 'TRIMESTRE')).toBe('TRIMESTRE');
  });
});

describe('régime dominant, quand aucune classe n’est en vue', () => {
  it('ne dit « semestre » que pour un lycée seul', () => {
    expect(regimeDominant(['LYCEE'], 'SEMESTRE')).toBe('SEMESTRE');
  });

  it('le trimestre l’emporte dès qu’un collège est là', () => {
    // Ses trois périodes couvrent les deux du lycée : aucune donnée n'est hors
    // d'atteinte depuis un écran global.
    expect(regimeDominant(['COLLEGE', 'LYCEE'], 'SEMESTRE')).toBe('TRIMESTRE');
    expect(regimeDominant(['COLLEGE'], 'SEMESTRE')).toBe('TRIMESTRE');
  });

  it('ne dit jamais « semestre » à une école qui n’a pas choisi le semestre', () => {
    expect(regimeDominant(['LYCEE'], 'TRIMESTRE')).toBe('TRIMESTRE');
    expect(regimeDominant(['COLLEGE', 'LYCEE'], 'TRIMESTRE')).toBe('TRIMESTRE');
  });
});

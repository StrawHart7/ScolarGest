import { describe, it, expect } from 'vitest';
import {
  evaluerAcces,
  ecritureAutorisee,
  joursAvantEcheance,
  statutEffectif,
  debutProchainePeriode,
  finDePeriode,
  palierRelance,
  JOURS_AVERTISSEMENT,
  JOURS_ESSAI,
  PALIERS_RELANCE_ESSAI,
  PALIERS_RELANCE_ABONNEMENT,
  finEssai,
} from '../abonnement-acces';

/** Une suspension plateforme, telle que la porte l'établissement depuis 0026. */
const SUSPENSION = { le: '2026-08-01T00:00:00Z', motif: 'Impayé de trois mois malgré relances.' };

const MAINTENANT = new Date('2026-08-19T10:00:00Z');
const dans = (jours: number) =>
  new Date(MAINTENANT.getTime() + jours * 24 * 60 * 60 * 1000).toISOString();

describe('joursAvantEcheance', () => {
  it('compte les jours restants', () => {
    expect(joursAvantEcheance(dans(45), MAINTENANT)).toBe(45);
  });

  it('devient négatif après l échéance', () => {
    expect(joursAvantEcheance(dans(-3), MAINTENANT)).toBe(-3);
  });
});

describe('statutEffectif', () => {
  it('AUCUN quand aucun abonnement n est enregistré', () => {
    expect(statutEffectif(null, MAINTENANT)).toBe('AUCUN');
  });

  it('garde ACTIF tant que l échéance est à venir', () => {
    expect(statutEffectif({ statut: 'ACTIF', dateFin: dans(10) }, MAINTENANT)).toBe('ACTIF');
  });

  it('considère EXPIRE un ACTIF dont l échéance est passée, même non balayé en base', () => {
    expect(statutEffectif({ statut: 'ACTIF', dateFin: dans(-1) }, MAINTENANT)).toBe('EXPIRE');
  });

  it('traite une ligne SUSPENDU d archive comme expirée, jamais comme active', () => {
    // `SUSPENDU` n est plus écrit depuis la migration 0026 : la suspension vit
    // sur l établissement. Une ligne héritée ne doit pas rouvrir l accès.
    expect(statutEffectif({ statut: 'SUSPENDU', dateFin: dans(200) }, MAINTENANT)).toBe('EXPIRE');
  });
});

describe('evaluerAcces', () => {
  it('OK loin de l échéance, sans message', () => {
    const acces = evaluerAcces({ abonnement: { statut: 'ACTIF', dateFin: dans(120) } }, MAINTENANT);
    expect(acces.niveau).toBe('OK');
    expect(acces.message).toBeNull();
    expect(ecritureAutorisee(acces.niveau)).toBe(true);
  });

  it('AVERTISSEMENT dans la fenêtre des 30 jours, sans bloquer l écriture', () => {
    const acces = evaluerAcces({ abonnement: { statut: 'ACTIF', dateFin: dans(JOURS_AVERTISSEMENT) } }, MAINTENANT);
    expect(acces.niveau).toBe('AVERTISSEMENT');
    expect(acces.message).toContain('30 jours');
    expect(ecritureAutorisee(acces.niveau)).toBe(true);
  });

  it('accorde encore un jour entier la veille de l échéance', () => {
    const acces = evaluerAcces({ abonnement: { statut: 'ACTIF', dateFin: dans(1) } }, MAINTENANT);
    expect(acces.niveau).toBe('AVERTISSEMENT');
    expect(acces.message).toContain('1 jour.');
  });

  it('LECTURE_SEULE une fois expiré : écriture refusée, consultation possible', () => {
    const acces = evaluerAcces({ abonnement: { statut: 'ACTIF', dateFin: dans(-1) } }, MAINTENANT);
    expect(acces.niveau).toBe('LECTURE_SEULE');
    expect(acces.statut).toBe('EXPIRE');
    expect(ecritureAutorisee(acces.niveau)).toBe(false);
  });

  it('LECTURE_SEULE quand aucun abonnement n existe et que l essai est passé', () => {
    const acces = evaluerAcces(
      { abonnement: null, essaiDebuteLe: dans(-90), essaiFinLe: dans(-60) },
      MAINTENANT,
    );
    expect(acces.niveau).toBe('LECTURE_SEULE');
    expect(acces.joursRestants).toBeNull();
  });

  it('BLOQUE sur suspension de l établissement, plus strict que l expiration', () => {
    const acces = evaluerAcces(
      { abonnement: { statut: 'ACTIF', dateFin: dans(200) }, suspension: SUSPENSION },
      MAINTENANT,
    );
    expect(acces.niveau).toBe('BLOQUE');
    expect(ecritureAutorisee(acces.niveau)).toBe(false);
  });

  it('affiche le motif de suspension, qui est destiné à l école', () => {
    // Une école coupée sans explication appelle le support pour demander
    // pourquoi ; celle qui lit le motif appelle pour le résoudre.
    const acces = evaluerAcces({ abonnement: null, suspension: SUSPENSION }, MAINTENANT);
    expect(acces.motifSuspension).toBe(SUSPENSION.motif);
    expect(acces.message).toContain(SUSPENSION.motif);
  });
});

describe('école neuve, avant le démarrage de l essai', () => {
  it('AVANT_ESSAI quand rien n a jamais été souscrit ni démarré', () => {
    const acces = evaluerAcces({ abonnement: null }, MAINTENANT);
    expect(acces.niveau).toBe('AVANT_ESSAI');
    expect(acces.statut).toBe('AVANT_ESSAI');
  });

  it('n accueille pas une école neuve par « contactez ScolarGest »', () => {
    // C est le message de la lecture seule, et il n a rien à faire là : cette
    // école n a rien à régulariser, elle a une configuration à finir.
    const acces = evaluerAcces({ abonnement: null }, MAINTENANT);
    expect(acces.message).not.toContain('Contactez ScolarGest');
    expect(acces.message).toContain('configuration');
  });

  it('n autorise pas l écriture générale pour autant', () => {
    // Seul `/demarrage` est ouvert, et par le middleware : le niveau lui-même
    // ne doit pas laisser saisir des notes dans une école sans essai.
    expect(ecritureAutorisee('AVANT_ESSAI')).toBe(false);
  });

  it('la suspension prime même sur une école jamais démarrée', () => {
    const acces = evaluerAcces({ abonnement: null, suspension: SUSPENSION }, MAINTENANT);
    expect(acces.niveau).toBe('BLOQUE');
  });
});

describe('essai gratuit', () => {
  it('finEssai place l échéance 30 jours après le démarrage', () => {
    const fin = finEssai(MAINTENANT);
    expect(joursAvantEcheance(fin, MAINTENANT)).toBe(JOURS_ESSAI);
  });

  it('ESSAI autorise l écriture sans abonnement, et décompte les jours', () => {
    const acces = evaluerAcces({ abonnement: null, essaiFinLe: dans(12) }, MAINTENANT);
    expect(acces.niveau).toBe('ESSAI');
    expect(acces.statut).toBe('ESSAI');
    expect(acces.joursRestants).toBe(12);
    expect(ecritureAutorisee(acces.niveau)).toBe(true);
  });

  it('bascule en LECTURE_SEULE à la fin de l essai, avec un message dédié', () => {
    const acces = evaluerAcces({ abonnement: null, essaiFinLe: dans(-1) }, MAINTENANT);
    expect(acces.niveau).toBe('LECTURE_SEULE');
    expect(acces.message).toContain('essai gratuit est terminé');
    expect(ecritureAutorisee(acces.niveau)).toBe(false);
  });

  it('un abonnement payé prime sur l essai encore ouvert', () => {
    // Une école qui souscrit pendant son essai est une cliente : le décompte
    // doit disparaître de son bandeau, pas cohabiter avec l abonnement.
    const acces = evaluerAcces(
      { abonnement: { statut: 'ACTIF', dateFin: dans(300) }, essaiFinLe: dans(12) },
      MAINTENANT,
    );
    expect(acces.niveau).toBe('OK');
    expect(acces.statut).toBe('ACTIF');
  });

  it('la suspension prime sur un essai encore ouvert', () => {
    // Sinon une école suspendue pour litige retrouverait l écriture en
    // relançant simplement un essai.
    const acces = evaluerAcces(
      { abonnement: null, essaiFinLe: dans(12), suspension: SUSPENSION },
      MAINTENANT,
    );
    expect(acces.niveau).toBe('BLOQUE');
    expect(ecritureAutorisee(acces.niveau)).toBe(false);
  });

  it('un abonnement expiré ne ressuscite pas grâce à un essai déjà clos', () => {
    const acces = evaluerAcces(
      { abonnement: { statut: 'ACTIF', dateFin: dans(-5) }, essaiFinLe: dans(-40) },
      MAINTENANT,
    );
    expect(acces.niveau).toBe('LECTURE_SEULE');
  });
});


describe('debutProchainePeriode', () => {
  it("enchaîne sur la fin de l'essai plutôt que de le brûler", () => {
    // C est le défaut corrigé : la page de souscription promettait déjà que
    // souscrire pendant l essai n en fait rien perdre, mais le webhook ne
    // regardait que l abonnement. Payer au troisième jour coûtait 27 jours.
    const debut = debutProchainePeriode(dans(27), null, MAINTENANT);
    expect(debut.toISOString()).toBe(dans(27));
  });

  it('enchaîne sur la période en cours pour un renouvellement anticipé', () => {
    const debut = debutProchainePeriode(null, dans(40), MAINTENANT);
    expect(debut.toISOString()).toBe(dans(40));
  });

  it('retient la plus lointaine des deux échéances', () => {
    const debut = debutProchainePeriode(dans(10), dans(40), MAINTENANT);
    expect(debut.toISOString()).toBe(dans(40));
  });

  it('ne facture jamais rétroactivement une période échue', () => {
    const debut = debutProchainePeriode(dans(-30), dans(-5), MAINTENANT);
    expect(debut.getTime()).toBe(MAINTENANT.getTime());
  });

  it('démarre aujourd hui quand il n y a ni essai ni période', () => {
    expect(debutProchainePeriode(null, null, MAINTENANT).getTime()).toBe(MAINTENANT.getTime());
  });
});

describe('finDePeriode', () => {
  it('ajoute un mois de calendrier, pas trente jours', () => {
    // Un abonnement mensuel souscrit le 31 janvier échoit le 28 février.
    // Une addition de millisecondes donnerait le 2 ou 3 mars.
    const fin = finDePeriode(new Date('2026-01-31T00:00:00Z'), 'MOIS');
    expect(fin.getUTCMonth()).toBe(1);
    expect(fin.getUTCDate()).toBe(28);
  });

  it('ramène le 29 février au 28 quand l année suivante n est pas bissextile', () => {
    const fin = finDePeriode(new Date('2028-02-29T00:00:00Z'), 'AN');
    expect(fin.toISOString().slice(0, 10)).toBe('2029-02-28');
  });

  it('franchit décembre sans se tromper d année', () => {
    const fin = finDePeriode(new Date('2026-12-15T00:00:00Z'), 'MOIS');
    expect(fin.toISOString().slice(0, 10)).toBe('2027-01-15');
  });

  it('ajoute une année pour un plan annuel', () => {
    const fin = finDePeriode(new Date('2026-09-03T00:00:00Z'), 'AN');
    expect(fin.toISOString()).toBe('2027-09-03T00:00:00.000Z');
  });
});

describe('palierRelance', () => {
  it('retient le palier atteint le plus serré, pas le plus large', () => {
    // À six jours de l échéance, c est la relance J-7 qui vaut. Prendre le
    // plus large enverrait le message « quinze jours » à une école qui en a
    // six.
    expect(palierRelance(6, PALIERS_RELANCE_ABONNEMENT)).toBe(7);
  });

  it('ne relance pas avant le premier palier', () => {
    expect(palierRelance(20, PALIERS_RELANCE_ABONNEMENT)).toBeNull();
    expect(palierRelance(8, PALIERS_RELANCE_ESSAI)).toBeNull();
  });

  it('rattrape un palier manqué plutôt que de le sauter', () => {
    // Un balayage resté silencieux trois jours doit envoyer la relance due,
    // pas passer à la suivante comme si de rien n était.
    expect(palierRelance(9, PALIERS_RELANCE_ABONNEMENT)).toBe(15);
  });

  it('bascule sur le palier 0 à l échéance et après', () => {
    expect(palierRelance(0, PALIERS_RELANCE_ESSAI)).toBe(0);
    expect(palierRelance(-12, PALIERS_RELANCE_ESSAI)).toBe(0);
  });

  it('relance l essai plus tard et plus serré que l abonnement', () => {
    // Une école en essai n a rien engagé et se décide dans les derniers jours ;
    // un renouvellement se prépare.
    expect(palierRelance(10, PALIERS_RELANCE_ESSAI)).toBeNull();
    expect(palierRelance(10, PALIERS_RELANCE_ABONNEMENT)).toBe(15);
  });
});

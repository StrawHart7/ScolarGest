import { describe, it, expect } from 'vitest';
import {
  evaluerAcces,
  ecritureAutorisee,
  joursAvantEcheance,
  statutEffectif,
  JOURS_AVERTISSEMENT,
  JOURS_ESSAI,
  finEssai,
} from '../abonnement-acces';

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

  it('SUSPENDU prime sur la date, y compris si l échéance est à venir', () => {
    expect(statutEffectif({ statut: 'SUSPENDU', dateFin: dans(200) }, MAINTENANT)).toBe('SUSPENDU');
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

  it('LECTURE_SEULE aussi quand aucun abonnement n existe', () => {
    const acces = evaluerAcces({ abonnement: null }, MAINTENANT);
    expect(acces.niveau).toBe('LECTURE_SEULE');
    expect(acces.statut).toBe('AUCUN');
    expect(acces.joursRestants).toBeNull();
  });

  it('BLOQUE sur suspension, plus strict que l expiration', () => {
    const acces = evaluerAcces({ abonnement: { statut: 'SUSPENDU', dateFin: dans(200) } }, MAINTENANT);
    expect(acces.niveau).toBe('BLOQUE');
    expect(ecritureAutorisee(acces.niveau)).toBe(false);
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
      { abonnement: { statut: 'SUSPENDU', dateFin: dans(200) }, essaiFinLe: dans(12) },
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

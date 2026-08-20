import { describe, it, expect } from 'vitest';
import {
  evaluerAcces,
  ecritureAutorisee,
  joursAvantEcheance,
  statutEffectif,
  JOURS_AVERTISSEMENT,
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
    const acces = evaluerAcces({ statut: 'ACTIF', dateFin: dans(120) }, MAINTENANT);
    expect(acces.niveau).toBe('OK');
    expect(acces.message).toBeNull();
    expect(ecritureAutorisee(acces.niveau)).toBe(true);
  });

  it('AVERTISSEMENT dans la fenêtre des 30 jours, sans bloquer l écriture', () => {
    const acces = evaluerAcces({ statut: 'ACTIF', dateFin: dans(JOURS_AVERTISSEMENT) }, MAINTENANT);
    expect(acces.niveau).toBe('AVERTISSEMENT');
    expect(acces.message).toContain('30 jours');
    expect(ecritureAutorisee(acces.niveau)).toBe(true);
  });

  it('accorde encore un jour entier la veille de l échéance', () => {
    const acces = evaluerAcces({ statut: 'ACTIF', dateFin: dans(1) }, MAINTENANT);
    expect(acces.niveau).toBe('AVERTISSEMENT');
    expect(acces.message).toContain('1 jour.');
  });

  it('LECTURE_SEULE une fois expiré : écriture refusée, consultation possible', () => {
    const acces = evaluerAcces({ statut: 'ACTIF', dateFin: dans(-1) }, MAINTENANT);
    expect(acces.niveau).toBe('LECTURE_SEULE');
    expect(acces.statut).toBe('EXPIRE');
    expect(ecritureAutorisee(acces.niveau)).toBe(false);
  });

  it('LECTURE_SEULE aussi quand aucun abonnement n existe', () => {
    const acces = evaluerAcces(null, MAINTENANT);
    expect(acces.niveau).toBe('LECTURE_SEULE');
    expect(acces.statut).toBe('AUCUN');
    expect(acces.joursRestants).toBeNull();
  });

  it('BLOQUE sur suspension, plus strict que l expiration', () => {
    const acces = evaluerAcces({ statut: 'SUSPENDU', dateFin: dans(200) }, MAINTENANT);
    expect(acces.niveau).toBe('BLOQUE');
    expect(ecritureAutorisee(acces.niveau)).toBe(false);
  });
});

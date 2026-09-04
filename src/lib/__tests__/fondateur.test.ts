import { describe, it, expect } from 'vitest';
import {
  montantPeriode,
  placesRestantes,
  programmeComplet,
  phrasePlaces,
} from '../fondateur';
import { PRIX_MENSUEL_PAR_CYCLE } from '../abonnement-formule';

describe('montantPeriode', () => {
  it('multiplie par cycle sur la grille standard', () => {
    // Oracle : un complexe college-lycee paie deux fois 10 000.
    expect(montantPeriode(PRIX_MENSUEL_PAR_CYCLE, 2, true)).toBe(20_000);
  });

  it('reste forfaitaire sur le plan fondateur', () => {
    // 15 000 quel que soit le nombre de cycles : c'est la difference de fond
    // entre les deux grilles, et elle doit etre verrouillee.
    expect(montantPeriode(15_000, 1, false)).toBe(15_000);
    expect(montantPeriode(15_000, 2, false)).toBe(15_000);
    expect(montantPeriode(15_000, 4, false)).toBe(15_000);
  });

  it('fait payer moins un complexe fondateur qu’un collège seul au tarif public', () => {
    // Consequence assumee de l'offre de lancement. Le test existe pour qu'elle
    // reste un choix constate, pas une surprise decouverte en facturant.
    const complexeFondateur = montantPeriode(15_000, 2, false);
    const collegeStandard = montantPeriode(PRIX_MENSUEL_PAR_CYCLE, 2, true);
    expect(complexeFondateur).toBeLessThan(collegeStandard);
  });
});

describe('places', () => {
  it('ne descend jamais sous zéro', () => {
    // Le declencheur en base refuse la onzieme, mais `placesMax` peut etre
    // abaisse apres coup : « -2 places » s'afficherait alors sur la page
    // d'accueil.
    expect(placesRestantes({ prises: 12, max: 10 })).toBe(0);
    expect(programmeComplet({ prises: 12, max: 10 })).toBe(true);
  });

  it('traite un programme sans plafond comme illimité', () => {
    expect(placesRestantes({ prises: 40, max: null })).toBeNull();
    expect(programmeComplet({ prises: 40, max: null })).toBe(false);
  });

  it('dit la vérité quand le programme est complet', () => {
    // Une offre qui alleche un visiteur qui ne pourra pas y entrer detruit la
    // confiance avant le premier contact.
    expect(phrasePlaces({ prises: 10, max: 10 })).toContain('complet');
  });

  it('accorde le singulier sur la dernière place', () => {
    expect(phrasePlaces({ prises: 9, max: 10 })).toBe('Il reste 1 place.');
  });

  it('annonce le reste et le total', () => {
    expect(phrasePlaces({ prises: 6, max: 10 })).toBe('Il reste 4 places sur 10.');
  });
});

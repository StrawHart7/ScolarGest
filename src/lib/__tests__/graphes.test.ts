import { describe, it, expect } from 'vitest';
import {
  calculerBornes,
  cheminLisse,
  positionsX,
  positionY,
  arcAnneau,
  abregerMontant,
  libelleMois,
} from '../graphes';

describe('calculerBornes', () => {
  it('part toujours de zero, jamais du minimum observe', () => {
    // Tronquer la base exagererait les variations : 90 000 apres 100 000
    // ressemblerait a un effondrement.
    expect(calculerBornes([90_000, 100_000]).min).toBe(0);
  });

  it('monte au prochain pas rond au lieu de coller au maximum', () => {
    const bornes = calculerBornes([47_694]);
    expect(bornes.max).toBeGreaterThan(47_694);
    expect(bornes.graduations[0]).toBe(0);
    expect(bornes.graduations.at(-1)).toBe(bornes.max);
  });

  it('produit des graduations regulieres et lisibles', () => {
    const { graduations } = calculerBornes([100]);
    const pas = graduations[1]! - graduations[0]!;
    for (let i = 1; i < graduations.length; i += 1) {
      expect(graduations[i]! - graduations[i - 1]!).toBeCloseTo(pas, 6);
    }
  });

  it('survit a une serie entierement vide sans diviser par zero', () => {
    const bornes = calculerBornes([0, 0, 0]);
    expect(bornes.max).toBe(1);
    expect(Number.isFinite(positionY(0, bornes, 100))).toBe(true);
  });
});

describe('cheminLisse', () => {
  it('ne depasse jamais sous zero apres un creux suivi d un pic', () => {
    // Le point du test : une spline de Catmull-Rom plongerait sous la ligne de
    // base ici, affichant des recettes negatives. L'interpolation monotone non.
    const points = [
      { x: 0, y: 100 },
      { x: 50, y: 100 },
      { x: 100, y: 0 },
      { x: 150, y: 100 },
    ];
    const chemin = cheminLisse(points);
    const ordonnees = [...chemin.matchAll(/[-\d.]+ ([-\d.]+)/g)].map((m) => Number(m[1]));
    // y = 100 est la ligne de base ; rien ne doit descendre plus bas (SVG
    // inverse), ni remonter au-dessus du sommet a y = 0.
    expect(Math.max(...ordonnees)).toBeLessThanOrEqual(100.001);
    expect(Math.min(...ordonnees)).toBeGreaterThanOrEqual(-0.001);
  });

  it('reste plat sur une serie constante', () => {
    const chemin = cheminLisse([
      { x: 0, y: 50 },
      { x: 10, y: 50 },
      { x: 20, y: 50 },
    ]);
    const ordonnees = [...chemin.matchAll(/[-\d.]+ ([-\d.]+)/g)].map((m) => Number(m[1]));
    for (const y of ordonnees) expect(y).toBeCloseTo(50, 6);
  });

  it('trace un segment droit a deux points, ou lisser n a pas de sens', () => {
    expect(cheminLisse([{ x: 0, y: 0 }, { x: 10, y: 10 }])).toBe('M 0 0 L 10 10');
  });

  it('rend une chaine vide sans point plutot que de lever', () => {
    expect(cheminLisse([])).toBe('');
  });
});

describe('positionsX', () => {
  it('fait toucher les deux bords', () => {
    const xs = positionsX(4, 300);
    expect(xs[0]).toBe(0);
    expect(xs.at(-1)).toBe(300);
  });

  it('centre un point unique au lieu de le coller a gauche', () => {
    expect(positionsX(1, 300)).toEqual([150]);
  });
});

describe('arcAnneau', () => {
  it('coupe un tour complet en deux moities', () => {
    // Un arc de 360 degres a des extremites confondues : le chemin serait vide.
    const chemin = arcAnneau(50, 50, 40, 28, 0, 360);
    expect(chemin.match(/A /g)?.length).toBe(4);
  });

  it('ferme le trace pour dessiner une couronne, pas un trait epais', () => {
    expect(arcAnneau(50, 50, 40, 28, 0, 90).trim().endsWith('Z')).toBe(true);
  });

  it('demarre a midi', () => {
    const chemin = arcAnneau(50, 50, 40, 28, 0, 90);
    expect(chemin.startsWith('M 50 10')).toBe(true);
  });
});

describe('abregerMontant', () => {
  it('abrege les milliers et les millions', () => {
    expect(abregerMontant(25_000)).toBe('25 k');
    expect(abregerMontant(1_500_000)).toBe('1,5 M');
  });

  it('laisse les petites valeurs intactes', () => {
    expect(abregerMontant(0)).toBe('0');
    expect(abregerMontant(750)).toBe('750');
  });
});

describe('libelleMois', () => {
  it('rend le mois en francais sans decalage de fuseau', () => {
    // Une cle « 2026-01 » interpretee en heure locale peut basculer sur
    // decembre a l'ouest de Greenwich.
    expect(libelleMois('2026-01')).toMatch(/janv/);
    expect(libelleMois('2026-12')).toMatch(/d[ée]c/);
  });
});

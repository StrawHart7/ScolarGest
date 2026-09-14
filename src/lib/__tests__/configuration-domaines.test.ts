import { describe, it, expect } from 'vitest';
import { PREREQUIS, TITRES_DOMAINE, type Domaine } from '../configuration-domaines';
import { cheminAutorise } from '../navigation';

const DOMAINES = Object.keys(PREREQUIS) as Domaine[];

/**
 * Un verrou qui propose une porte fermée est pire que pas de verrou.
 *
 * Tout le principe du panneau est de porter le remède : « voilà ce qui manque,
 * voilà où le régler ». Si le lien menait à un écran que le rôle ne peut pas
 * ouvrir, on aurait remplacé un mur muet par un mur poli — exactement ce qu'on
 * retire. Le Directeur peut tout faire dans son établissement depuis le
 * 2026-09-14 : c'est lui l'étalon.
 */
describe('les prérequis de domaine', () => {
  it('couvre chaque domaine avec au moins un prérequis', () => {
    expect(DOMAINES.length).toBeGreaterThan(0);
    for (const domaine of DOMAINES) {
      expect(PREREQUIS[domaine].length, `${domaine} n'a aucun prérequis`).toBeGreaterThan(0);
      expect(TITRES_DOMAINE[domaine], `${domaine} n'a pas de titre`).toBeTruthy();
    }
  });

  it('ne propose au Directeur que des écrans qu’il peut ouvrir', () => {
    for (const domaine of DOMAINES) {
      for (const prerequis of PREREQUIS[domaine]) {
        expect(
          cheminAutorise(prerequis.href, 'DIRECTEUR'),
          `${domaine}/${prerequis.sonde} renvoie le Directeur vers ${prerequis.href}, qui lui est refusé`,
        ).toBe(true);
      }
    }
  });

  it('ne nomme jamais deux fois la même sonde dans un domaine', () => {
    // Un doublon ferait compter deux fois le même manque et afficherait
    // « deux réglages manquent » pour un seul.
    for (const domaine of DOMAINES) {
      const sondes = PREREQUIS[domaine].map((p) => p.sonde);
      expect(new Set(sondes).size, `${domaine} répète une sonde`).toBe(sondes.length);
    }
  });

  it('dit la conséquence, et pas seulement le nom de la chose qui manque', () => {
    // Le panneau ne sert à rien s'il énumère des intitulés. « Vos tarifs » ne
    // pousse personne ; « sans eux une facture serait émise à zéro franc », si.
    for (const domaine of DOMAINES) {
      for (const p of PREREQUIS[domaine]) {
        expect(p.titre.trim().length, `${p.sonde} sans titre`).toBeGreaterThan(0);
        expect(p.pourquoi.trim().length, `${p.sonde} sans explication`).toBeGreaterThan(20);
        expect(p.action.trim().length, `${p.sonde} sans libellé d'action`).toBeGreaterThan(0);
        expect(p.href.startsWith('/'), `${p.sonde} : href relatif`).toBe(true);
      }
    }
  });
});

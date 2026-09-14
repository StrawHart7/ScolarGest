import { describe, it, expect } from 'vitest';
import { PREREQUIS, TITRES_DOMAINE, type Domaine } from '../configuration-domaines';
import { cheminAutorise } from '../navigation';
import { CATALOGUE } from '../conseils/catalogue';
import { choisirConseil, type Diagnostic } from '../conseils/choix';

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

/**
 * Le socle décide d'une redirection. Une entrée qui ne peut jamais être
 * satisfaite y enferme le Directeur.
 *
 * Tant qu'un élément `REQUIS` n'est pas fait, `/dashboard` renvoie vers la
 * configuration. Un élément sans sonde n'est jamais « fait » : le ratio
 * resterait bloqué et la redirection ne se lèverait plus. C'est le genre de
 * défaut qu'on n'ajoute pas exprès — on l'ajoute en marquant `socle` sur un
 * conseil de découverte, qui n'a pas de sonde par construction.
 */
describe('le socle de configuration', () => {
  const socle = CATALOGUE.filter((c) => c.socle);

  it('existe, et distingue l’indispensable du recommandé', () => {
    expect(socle.length).toBeGreaterThan(0);
    expect(socle.some((c) => c.socle === 'REQUIS')).toBe(true);
    expect(socle.some((c) => c.socle === 'RECOMMANDE')).toBe(true);
  });

  it('n’y met que des entrées mesurables', () => {
    for (const conseil of socle) {
      expect(conseil.sonde, `« ${conseil.id} » est dans le socle sans sonde : il ne pourra jamais être coché`).not.toBeNull();
    }
  });

  it('donne à chaque entrée un écran où la régler', () => {
    // Une ligne de checklist sans action est un reproche sans issue.
    for (const conseil of socle) {
      expect(conseil.action, `« ${conseil.id} » n'a aucune action`).not.toBeNull();
    }
  });

  it('laisse le Directeur régler tout l’indispensable lui-même', () => {
    // C'est la promesse du 2026-09-14 : il n'a besoin de personne pour finir
    // de configurer son établissement. Une ligne requise qu'il ne peut pas
    // atteindre ferait mentir la checklist et le bloquerait sur la redirection.
    for (const conseil of socle.filter((c) => c.socle === 'REQUIS')) {
      expect(conseil.roles, `« ${conseil.id} » est requis mais fermé au Directeur`).toContain(
        'DIRECTEUR',
      );
      if (conseil.action) {
        expect(
          cheminAutorise(conseil.action.href, 'DIRECTEUR'),
          `« ${conseil.id} » renvoie le Directeur vers ${conseil.action.href}, qui lui est refusé`,
        ).toBe(true);
      }
    }
  });

  it('sort l’indispensable de la rotation des conseils, et y laisse le recommandé', () => {
    // Trois voix pour la même chose seraient du harcèlement ; zéro voix pour un
    // filigrane que personne ne devine serait un oubli.
    //
    // Le diagnostic est tout à zéro : rien n'est fait, donc **tout** est
    // candidat. Ce que la rotation rend alors ne peut être qu'une entrée hors
    // socle requis — sinon l'exclusion de `choisirConseil` ne tient pas.
    const requis = CATALOGUE.filter((c) => c.socle === 'REQUIS').map((c) => c.id);
    const diagnostic: Diagnostic = Object.fromEntries(
      CATALOGUE.filter((c) => c.sonde).map((c) => [c.sonde as string, { fait: 0, total: 1 }]),
    );
    const choix = choisirConseil({
      role: 'DIRECTEUR',
      diagnostic,
      historique: [],
      dernierAffichageLe: null,
      urlCourante: '/dashboard',
      ecritureAutorisee: true,
      maintenant: new Date('2026-09-14T10:00:00.000Z'),
      compteCreeLe: '2026-01-01T00:00:00.000Z',
    });

    if (choix) {
      expect(
        requis,
        `« ${choix.conseil.id} » est requis : il ne doit pas passer par la rotation`,
      ).not.toContain(choix.conseil.id);
    }
    // Et le recommandé reste bien servi par la rotation : il n'a aucune autre
    // voix, ni verrou ni comptage, pour se faire connaître.
    expect(CATALOGUE.filter((c) => c.socle === 'RECOMMANDE').length).toBeGreaterThan(0);
  });
});

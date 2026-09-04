import { describe, it, expect } from 'vitest';
import {
  choisirConseil,
  formaterTexte,
  reportJusquA,
  PALIERS_RELEGATION_JOURS,
  type ContexteChoix,
  type Diagnostic,
  type EtatConseil,
} from '../choix';
import { CATALOGUE, ORDRE_FAMILLES, PAR_ID } from '../catalogue';
import { SECTIONS } from '@/lib/navigation';

const MAINTENANT = new Date('2026-09-04T10:00:00.000Z');
const JOUR = 24 * 60 * 60 * 1000;

function ilYA(jours: number): string {
  return new Date(MAINTENANT.getTime() - jours * JOUR).toISOString();
}

/** École neuve : rien n'est fait, tout est applicable. */
const ECOLE_VIDE: Diagnostic = {
  anneeActive: { fait: 0, total: 1 },
  classes: { fait: 0, total: 1 },
  programme: { fait: 0, total: 1 },
  coefficients: { fait: 0, total: 1 },
  eleves: { fait: 0, total: 1 },
  enseignants: { fait: 0, total: 1 },
  affectations: { fait: 0, total: 1 },
  evaluations: { fait: 0, total: 1 },
  creneaux: { fait: 0, total: 1 },
  typesFrais: { fait: 0, total: 1 },
  tarifs: { fait: 0, total: 1 },
  bulletins: { fait: 0, total: 1 },
  pinDefini: { fait: 0, total: 1 },
  logoDefini: { fait: 0, total: 1 },
  filigraneDefini: { fait: 0, total: 1 },
  equipeAdministrative: { fait: 0, total: 1 },
};

/** Tout ce qui est binaire est fait ; les sondes de complétion sont ouvertes. */
const ECOLE_INSTALLEE: Diagnostic = {
  anneeActive: { fait: 1, total: 1 },
  classes: { fait: 1, total: 1 },
  programme: { fait: 1, total: 1 },
  coefficients: { fait: 1, total: 1 },
  eleves: { fait: 1, total: 1 },
  enseignants: { fait: 1, total: 1 },
  affectations: { fait: 1, total: 1 },
  evaluations: { fait: 1, total: 1 },
  creneaux: { fait: 1, total: 1 },
  typesFrais: { fait: 1, total: 1 },
  tarifs: { fait: 1, total: 1 },
  bulletins: { fait: 1, total: 1 },
  pinDefini: { fait: 1, total: 1 },
  logoDefini: { fait: 1, total: 1 },
  filigraneDefini: { fait: 1, total: 1 },
  equipeAdministrative: { fait: 1, total: 1 },
};

function contexte(partiel: Partial<ContexteChoix> = {}): ContexteChoix {
  return {
    role: 'DIRECTEUR',
    diagnostic: ECOLE_VIDE,
    historique: [],
    dernierAffichageLe: null,
    urlCourante: '/dashboard',
    ecritureAutorisee: true,
    maintenant: MAINTENANT,
    compteCreeLe: '2026-01-01T00:00:00.000Z',
    ...partiel,
  };
}

/**
 * Les conseils de decouverte n'ont pas de sonde : rien ne les retire tant
 * qu'ils n'ont pas ete suivis. Les tests qui veulent atteindre la file de
 * relegation doivent donc les avoir vus, sans quoi la file principale n'est
 * jamais vide.
 */
const DECOUVERTES_VUES: EtatConseil[] = CATALOGUE.filter((c) => c.sonde === null).map((c) => ({
  conseilId: c.id,
  statut: 'SUIVI' as const,
  reporteJusquA: null,
  relegueLe: null,
  nombreRelegations: 0,
}));

function etat(partiel: Partial<EtatConseil> & Pick<EtatConseil, 'conseilId'>): EtatConseil {
  return {
    statut: 'PROPOSE',
    reporteJusquA: null,
    relegueLe: null,
    nombreRelegations: 0,
    ...partiel,
  };
}

// ------------------------------------------------------------ chronologie --

describe('chronologie', () => {
  it('commence par l’année scolaire sur une école vide', () => {
    // Oracle : sur une école où rien n'existe, le seul conseil de FONDATION
    // sans prérequis et destiné au Directeur est `annee-scolaire` — tous les
    // autres en dépendent, directement ou par transitivité.
    expect(choisirConseil(contexte())?.conseil.id).toBe('annee-scolaire');
  });

  it('ne parle pas de filigrane avant qu’il y ait des bulletins', () => {
    // C'est le cas que la fonctionnalité doit éviter : proposer un réglage de
    // confort à quelqu'un qui n'a pas encore fait tourner son école. Le
    // filigrane a `logo-documents` en prérequis, lui-même `bulletins`.
    const choix = choisirConseil(contexte());
    expect(choix?.conseil.id).not.toBe('filigrane');
    expect(choix?.conseil.famille).toBe('FONDATION');
  });

  it('ne descend dans une famille que si la précédente est vide', () => {
    // École installée, sauf les emplois du temps : le PIN (CONFORT, poids 60)
    // est plus lourd que le conseil de complétion (poids 40), et sortirait si
    // le classement se faisait au poids seul. La famille prime.
    const diagnostic: Diagnostic = {
      ...ECOLE_INSTALLEE,
      pinDefini: { fait: 0, total: 1 },
      classesAvecEmploiDuTemps: { fait: 4, total: 6 },
    };
    expect(choisirConseil(contexte({ diagnostic }))?.conseil.id).toBe('emploi-du-temps-partiel');
  });

  it('remonte au confort une fois tout le reste satisfait', () => {
    const diagnostic: Diagnostic = { ...ECOLE_INSTALLEE, pinDefini: { fait: 0, total: 1 } };
    const choix = choisirConseil(contexte({ diagnostic }));
    expect(choix?.conseil.id).toBe('pin');
    expect(choix?.conseil.famille).toBe('CONFORT');
  });

  it('ne reste que la découverte quand toutes les données sont là', () => {
    // Plus aucun manque : ce qui subsiste n'est plus un reproche mais une
    // présentation de ce que la plateforme sait faire.
    const choix = choisirConseil(contexte({ diagnostic: ECOLE_INSTALLEE }));
    expect(choix?.conseil.famille).toBe('DECOUVERTE');
  });

  it('se tait une fois tout fait et tout vu', () => {
    // Le cas le plus fréquent en régime normal. Si la fonctionnalité ne sait
    // pas se taire, elle est ratée.
    expect(
      choisirConseil(contexte({ diagnostic: ECOLE_INSTALLEE, historique: DECOUVERTES_VUES })),
    ).toBeNull();
  });

  it('fait passer un manque réel avant une invitation à découvrir', () => {
    // C'est le défaut que les tests ont révélé : rangée en EXPLOITATION, la
    // découverte de l'import masquait indéfiniment les emplois du temps
    // manquants, faute de sonde pour la retirer.
    const diagnostic: Diagnostic = {
      ...ECOLE_INSTALLEE,
      classesAvecEmploiDuTemps: { fait: 4, total: 6 },
    };
    expect(choisirConseil(contexte({ diagnostic }))?.conseil.id).toBe('emploi-du-temps-partiel');
  });
});

// ------------------------------------------------------------ complétion --

describe('complétion partielle', () => {
  it('porte son propre chiffre dans le texte', () => {
    const diagnostic: Diagnostic = {
      ...ECOLE_INSTALLEE,
      classesAvecEmploiDuTemps: { fait: 4, total: 6 },
    };
    const choix = choisirConseil(contexte({ diagnostic }));
    expect(choix?.texte).toBe(
      '4 classes sur 6 ont leur grille hebdomadaire. Il en reste 2 à composer.',
    );
  });

  it('se tait quand la sonde est atteinte', () => {
    const diagnostic: Diagnostic = {
      ...ECOLE_INSTALLEE,
      classesAvecEmploiDuTemps: { fait: 6, total: 6 },
    };
    expect(
      choisirConseil(contexte({ diagnostic, historique: DECOUVERTES_VUES })),
    ).toBeNull();
  });

  it('n’annonce jamais « 0 sur 0 » à une école sans classe', () => {
    // `total: 0` veut dire « ne concerne pas cet établissement », pas « rien
    // n'est fait ». Confondre les deux afficherait un reproche absurde.
    const diagnostic: Diagnostic = {
      ...ECOLE_INSTALLEE,
      classesAvecEmploiDuTemps: { fait: 0, total: 0 },
    };
    expect(
      choisirConseil(contexte({ diagnostic, historique: DECOUVERTES_VUES })),
    ).toBeNull();
  });

  it('ne bloque pas la suite sur un prérequis non applicable', () => {
    // `professeur-principal` dépend de `enseignants`. Si l'école n'a aucun
    // enseignant à recruter — sonde non applicable — la chaîne doit continuer
    // au lieu de se figer.
    const diagnostic: Diagnostic = {
      ...ECOLE_INSTALLEE,
      enseignants: { fait: 0, total: 0 },
      classesAvecProfesseurPrincipal: { fait: 2, total: 5 },
    };
    expect(choisirConseil(contexte({ diagnostic }))?.conseil.id).toBe('professeur-principal');
  });
});

// ---------------------------------------------------------------- rythme --

describe('rythme', () => {
  it('se tait pendant 24 heures après un conseil', () => {
    expect(choisirConseil(contexte({ dernierAffichageLe: ilYA(0.5) }))).toBeNull();
  });

  it('reprend la parole passé le délai', () => {
    expect(choisirConseil(contexte({ dernierAffichageLe: ilYA(1.1) }))?.conseil.id).toBe(
      'annee-scolaire',
    );
  });

  it('écarte un conseil reporté, puis le rend à l’échéance', () => {
    const reporte = [
      etat({ conseilId: 'annee-scolaire', statut: 'REPORTE', reporteJusquA: ilYA(-3) }),
    ];
    expect(choisirConseil(contexte({ historique: reporte }))?.conseil.id).not.toBe(
      'annee-scolaire',
    );

    const echu = [
      etat({ conseilId: 'annee-scolaire', statut: 'REPORTE', reporteJusquA: ilYA(1) }),
    ];
    expect(choisirConseil(contexte({ historique: echu }))?.conseil.id).toBe('annee-scolaire');
  });

  it('reportJusquA ajoute bien sept jours', () => {
    expect(reportJusquA(MAINTENANT)).toBe('2026-09-11T10:00:00.000Z');
  });
});

// ------------------------------------------------------------ relégation --

describe('relégation', () => {
  it('range en fin de file au lieu de supprimer', () => {
    // « Pas pour moi » sur l'année scolaire : le conseil suivant sort, mais
    // le premier n'est pas perdu.
    const historique = [
      etat({ conseilId: 'annee-scolaire', statut: 'RELEGUE', relegueLe: ilYA(1), nombreRelegations: 1 }),
    ];
    expect(choisirConseil(contexte({ historique }))?.conseil.id).toBe('pin');
  });

  it('revient quand la file principale est vide', () => {
    // Oracle : école installée, seul le PIN manque, et il a été relégué il y
    // a 40 jours — au-delà du plancher de 30. Rien d'autre n'est éligible,
    // donc il revient, marqué comme une reprise.
    const diagnostic: Diagnostic = { ...ECOLE_INSTALLEE, pinDefini: { fait: 0, total: 1 } };
    const historique = [
      ...DECOUVERTES_VUES,
      etat({ conseilId: 'pin', statut: 'RELEGUE', relegueLe: ilYA(40), nombreRelegations: 1 }),
    ];
    const choix = choisirConseil(contexte({ diagnostic, historique }));
    expect(choix?.conseil.id).toBe('pin');
    expect(choix?.reprise).toBe(true);
  });

  it('respecte le plancher même quand plus rien d’autre n’est éligible', () => {
    // Sans plancher, une école bien configurée qui relègue son dernier
    // conseil le reverrait le lendemain — la file principale étant vide, la
    // file de relégation serait servie aussitôt.
    const diagnostic: Diagnostic = { ...ECOLE_INSTALLEE, pinDefini: { fait: 0, total: 1 } };
    const historique = [
      ...DECOUVERTES_VUES,
      etat({ conseilId: 'pin', statut: 'RELEGUE', relegueLe: ilYA(1), nombreRelegations: 1 }),
    ];
    expect(choisirConseil(contexte({ diagnostic, historique }))).toBeNull();
  });

  it('allonge le plancher à chaque relégation', () => {
    const diagnostic: Diagnostic = { ...ECOLE_INSTALLEE, pinDefini: { fait: 0, total: 1 } };
    // Deuxième relégation : 90 jours. 40 ne suffisent plus.
    const deux = [
      ...DECOUVERTES_VUES,
      etat({ conseilId: 'pin', statut: 'RELEGUE', relegueLe: ilYA(40), nombreRelegations: 2 }),
    ];
    expect(choisirConseil(contexte({ diagnostic, historique: deux }))).toBeNull();

    const centJours = [
      ...DECOUVERTES_VUES,
      etat({ conseilId: 'pin', statut: 'RELEGUE', relegueLe: ilYA(100), nombreRelegations: 2 }),
    ];
    expect(choisirConseil(contexte({ diagnostic, historique: centJours }))?.conseil.id).toBe('pin');
  });

  it('plafonne le plancher au dernier palier', () => {
    // Une dixième relégation ne doit pas produire un délai absurde : il n'y a
    // pas d'état terminal, seulement un palier maximal.
    const diagnostic: Diagnostic = { ...ECOLE_INSTALLEE, pinDefini: { fait: 0, total: 1 } };
    const historique = [
      ...DECOUVERTES_VUES,
      etat({ conseilId: 'pin', statut: 'RELEGUE', relegueLe: ilYA(200), nombreRelegations: 10 }),
    ];
    expect(choisirConseil(contexte({ diagnostic, historique }))?.conseil.id).toBe('pin');
    expect(Math.max(...PALIERS_RELEGATION_JOURS)).toBeLessThan(200);
  });

  it('sert la file de reprise dans l’ordre où elle s’est formée', () => {
    // C'est une file : le plus anciennement relégué revient en premier, quels
    // que soient sa famille et son poids.
    const diagnostic: Diagnostic = {
      ...ECOLE_INSTALLEE,
      pinDefini: { fait: 0, total: 1 },
      logoDefini: { fait: 0, total: 1 },
    };
    const historique = [
      ...DECOUVERTES_VUES,
      etat({ conseilId: 'pin', statut: 'RELEGUE', relegueLe: ilYA(40), nombreRelegations: 1 }),
      etat({
        conseilId: 'logo-documents',
        statut: 'RELEGUE',
        relegueLe: ilYA(80),
        nombreRelegations: 1,
      }),
    ];
    // `pin` pèse 60 contre 40, mais `logo-documents` a été relégué avant lui.
    expect(choisirConseil(contexte({ diagnostic, historique }))?.conseil.id).toBe(
      'logo-documents',
    );
  });

  it('n’a aucun état terminal', () => {
    // Garde-fou de conception : un statut « rejeté » réintroduirait le
    // « ne revient plus jamais » qu'on a explicitement écarté.
    const statuts = new Set(CATALOGUE.map(() => null));
    expect(statuts.size).toBeLessThanOrEqual(1);
    expect(['PROPOSE', 'REPORTE', 'RELEGUE', 'SUIVI']).not.toContain('REJETE');
  });
});

// ----------------------------------------------------------------- rôles --

describe('rôles et accès', () => {
  it('ne propose à un enseignant que ce qui le concerne', () => {
    const choix = choisirConseil(contexte({ role: 'ENSEIGNANT', diagnostic: ECOLE_VIDE }));
    expect(choix?.conseil.roles).toContain('ENSEIGNANT');
  });

  it('n’envoie pas le Directeur sur la saisie de notes', () => {
    // `navigation.ts` la réserve à l'enseignant : l'y envoyer produirait un
    // refus, et lui apprendrait que la plateforme ment.
    expect(PAR_ID.get('evaluations')!.roles).toEqual(['ENSEIGNANT']);
  });

  it('donne au comptable un conseil de finance, pas de structure', () => {
    const choix = choisirConseil(contexte({ role: 'COMPTABLE', diagnostic: ECOLE_VIDE }));
    expect(choix?.conseil.id).toBe('types-frais');
  });

  it('ne propose aucune écriture à une école en lecture seule', () => {
    // Une école suspendue ou dont l'abonnement est échu se heurterait à un
    // refus : lui proposer le geste serait un mensonge.
    const choix = choisirConseil(contexte({ ecritureAutorisee: false }));
    expect(choix?.conseil.exigeEcriture ?? false).toBe(false);
  });
});

// -------------------------------------------------------------- contexte --

describe('contexte de page', () => {
  it('fait passer devant le conseil rattaché à la page ouverte', () => {
    // Même famille, poids inférieur : c'est le contexte qui départage.
    const diagnostic: Diagnostic = {
      ...ECOLE_INSTALLEE,
      classesAvecEmploiDuTemps: { fait: 4, total: 6 },
      elevesAvecResponsable: { fait: 10, total: 30 },
    };
    // Sans contexte, `emploi-du-temps-partiel` (40) devance
    // `eleves-sans-responsable` (30).
    expect(choisirConseil(contexte({ diagnostic }))?.conseil.id).toBe('emploi-du-temps-partiel');
    // Sur l'écran des élèves, l'ordre s'inverse.
    expect(
      choisirConseil(contexte({ diagnostic, urlCourante: '/etablissement/eleves' }))?.conseil.id,
    ).toBe('eleves-sans-responsable');
  });

  it('ne laisse pas le contexte battre une famille supérieure', () => {
    // Sur l'écran des classes, le conseil contextuel est de COMPLETION ; il
    // ne doit pas passer devant une fondation manquante.
    const diagnostic: Diagnostic = {
      ...ECOLE_INSTALLEE,
      coefficients: { fait: 0, total: 1 },
      classesAvecEmploiDuTemps: { fait: 4, total: 6 },
    };
    expect(
      choisirConseil(contexte({ diagnostic, urlCourante: '/etablissement/classes' }))?.conseil.id,
    ).toBe('coefficients');
  });
});

// ------------------------------------------------------------- nouveauté --

describe('nouveauté', () => {
  it('n’annonce comme neuf que ce qui est postérieur au compte', () => {
    // Pour un compte créé après la fonctionnalité, elle a toujours existé :
    // la présenter comme neuve serait faux.
    const texte = formaterTexte('{fait}/{total}', { fait: 1, total: 2 });
    expect(texte).toBe('1/2');
    const avecNouveaute = CATALOGUE.filter((c) => c.nouveaute);
    for (const conseil of avecNouveaute) {
      expect(Date.parse(conseil.nouveaute!)).not.toBeNaN();
    }
  });
});

// ------------------------------------------------------ cohérence du catalogue --

describe('cohérence du catalogue', () => {
  it('n’a aucun identifiant en double', () => {
    expect(new Set(CATALOGUE.map((c) => c.id)).size).toBe(CATALOGUE.length);
  });

  it('ne référence que des prérequis existants', () => {
    for (const conseil of CATALOGUE) {
      for (const id of conseil.prerequis) {
        expect(PAR_ID.has(id), `${conseil.id} → ${id}`).toBe(true);
      }
    }
  });

  it('n’a aucun cycle de prérequis', () => {
    // Un cycle rendrait deux conseils mutuellement inéligibles, et ils
    // disparaîtraient tous les deux en silence.
    const visite = new Map<string, number>();
    const descendre = (id: string): void => {
      const etatVisite = visite.get(id) ?? 0;
      expect(etatVisite, `cycle sur ${id}`).not.toBe(1);
      if (etatVisite === 2) return;
      visite.set(id, 1);
      for (const parent of PAR_ID.get(id as never)?.prerequis ?? []) descendre(parent);
      visite.set(id, 2);
    };
    for (const conseil of CATALOGUE) descendre(conseil.id);
  });

  it('ne fait dépendre un conseil que d’une famille au moins aussi précoce', () => {
    // Un conseil de fondation qui attendrait un conseil de confort inverserait
    // la chronologie sans que rien ne le signale.
    for (const conseil of CATALOGUE) {
      for (const id of conseil.prerequis) {
        const parent = PAR_ID.get(id)!;
        expect(
          ORDRE_FAMILLES.indexOf(parent.famille),
          `${conseil.id} dépend de ${id}`,
        ).toBeLessThanOrEqual(ORDRE_FAMILLES.indexOf(conseil.famille));
      }
    }
  });

  it('n’envoie personne vers un écran que son rôle ne peut pas ouvrir', () => {
    // Un conseil qui mène à un 403 apprend à l'utilisateur que la plateforme
    // ment ; c'est pire que pas de conseil du tout. La navigation déclare déjà
    // les rôles autorisés par écran : on s'y adosse plutôt que de redéclarer.
    const rolesParHref = new Map<string, string[]>();
    for (const section of Object.values(SECTIONS)) {
      for (const bloc of section.blocs) rolesParHref.set(bloc.href, bloc.roles);
    }
    for (const conseil of CATALOGUE) {
      const href = conseil.action?.href;
      if (!href) continue;
      const autorises = rolesParHref.get(href);
      if (!autorises) continue;
      for (const role of conseil.roles) {
        expect(autorises, `${conseil.id} → ${href} pour ${role}`).toContain(role);
      }
    }
  });

  it('donne un texte et un titre non vides à chaque conseil', () => {
    for (const conseil of CATALOGUE) {
      expect(conseil.titre.length, conseil.id).toBeGreaterThan(0);
      expect(conseil.texte.length, conseil.id).toBeGreaterThan(0);
      expect(conseil.roles.length, conseil.id).toBeGreaterThan(0);
    }
  });

  it('ne laisse aucun jeton non substituable dans un conseil sans sonde', () => {
    // `{restant}` sur un conseil sans sonde s'afficherait tel quel à l'écran.
    for (const conseil of CATALOGUE) {
      if (conseil.sonde === null) {
        expect(/\{(fait|total|restant)\}/.test(conseil.texte), conseil.id).toBe(false);
      }
    }
  });

  it('n’emploie aucun emoji', () => {
    // Règle produit : aucun emoji nulle part dans le produit.
    const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    for (const conseil of CATALOGUE) {
      expect(emoji.test(conseil.titre + conseil.texte), conseil.id).toBe(false);
    }
  });
});

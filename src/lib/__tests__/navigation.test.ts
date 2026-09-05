import { describe, expect, it } from 'vitest';
import { cheminAutorise, SECTIONS, getSidebarItems } from '@/lib/navigation';
import type { Role } from '@/services/tenant';

const ROLES_ECOLE: Role[] = ['DIRECTEUR', 'SECRETAIRE', 'COMPTABLE', 'ENSEIGNANT'];

describe('cheminAutorise', () => {
  it("refuse au Directeur l'approbation des notes, réservée à la Secrétaire", () => {
    // Régression du 2026-09-05 : la tuile « Notes à approuver » du tableau de
    // bord Directeur pointait vers cette page, dont la garde est
    // `requireRole('SECRETAIRE')`. Le Directeur recevait un écran d'erreur
    // depuis sa propre page d'accueil.
    expect(cheminAutorise('/etablissement/notes/approbation', 'DIRECTEUR')).toBe(false);
    expect(cheminAutorise('/etablissement/notes/approbation', 'SECRETAIRE')).toBe(true);
  });

  it('autorise un chemin inconnu du catalogue', () => {
    // Le catalogue ne couvre pas les sous-pages. Répondre `false` par défaut
    // ferait disparaître des liens valides des tableaux de bord.
    expect(cheminAutorise('/etablissement/eleves/nouvelle', 'SECRETAIRE')).toBe(true);
    expect(cheminAutorise('/abonnement/souscrire', 'COMPTABLE')).toBe(true);
  });

  it('laisse tout passer au SUPER_ADMIN', () => {
    expect(cheminAutorise('/etablissement/notes/approbation', 'SUPER_ADMIN')).toBe(true);
  });

  it('accorde à chaque rôle les blocs de section qui le nomment', () => {
    for (const section of Object.values(SECTIONS)) {
      for (const bloc of section.blocs) {
        for (const role of bloc.roles) {
          expect(cheminAutorise(bloc.href, role), `${role} → ${bloc.href}`).toBe(true);
        }
      }
    }
  });

  it('accorde à chaque rôle les entrées de barre latérale qu’on lui propose', () => {
    // Sans quoi le filet retirerait un lien du tableau de bord alors que la
    // barre latérale propose la même destination — incohérence visible.
    for (const role of ROLES_ECOLE) {
      for (const item of getSidebarItems(role)) {
        expect(cheminAutorise(item.href, role), `${role} → ${item.href}`).toBe(true);
      }
    }
  });
});

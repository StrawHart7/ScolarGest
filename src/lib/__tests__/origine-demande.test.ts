import { describe, it, expect } from 'vitest';
import {
  CONTEXTE_ORIGINE,
  LIBELLE_ORIGINE,
  ORIGINES,
  PARAMETRE_OFFRE,
  estPrioritaire,
  jetonDe,
  lireOrigine,
  normaliserOrigine,
} from '../origine-demande';

describe('lireOrigine', () => {
  it('reconnaît le programme fondateur', () => {
    expect(lireOrigine('?offre=fondateur')).toBe('PROGRAMME_FONDATEUR');
  });

  it('reconnaît les deux offres publiques', () => {
    expect(lireOrigine('?offre=un-cycle')).toBe('OFFRE_1_CYCLE');
    expect(lireOrigine('?offre=deux-cycles')).toBe('OFFRE_2_CYCLES');
  });

  it('vaut DIRECT sans paramètre : bandeau, barre de navigation, bannière finale', () => {
    expect(lireOrigine('')).toBe('DIRECT');
    expect(lireOrigine('?utm_source=facebook')).toBe('DIRECT');
  });

  it('retombe sur DIRECT devant une valeur inventée', () => {
    // Le paramètre vient de l'extérieur. Perdre l'attribution d'un prospect
    // coûte infiniment moins cher que de perdre le prospect.
    expect(lireOrigine('?offre=gratuit-a-vie')).toBe('DIRECT');
    expect(lireOrigine('?offre=')).toBe('DIRECT');
  });

  it('garde l’offre au milieu d’autres paramètres', () => {
    expect(lireOrigine('?utm_source=x&offre=fondateur&ref=y')).toBe('PROGRAMME_FONDATEUR');
  });
});

describe('normaliserOrigine', () => {
  it('accepte une valeur du catalogue', () => {
    expect(normaliserOrigine('PROGRAMME_FONDATEUR')).toBe('PROGRAMME_FONDATEUR');
  });

  it('refuse tout le reste plutôt que de l’écrire en base', () => {
    // La colonne est un enum : une valeur hors catalogue ferait échouer
    // l'insertion, donc perdre la demande.
    expect(normaliserOrigine('FONDATEUR_PREMIUM')).toBe('DIRECT');
    expect(normaliserOrigine(null)).toBe('DIRECT');
    expect(normaliserOrigine(42)).toBe('DIRECT');
  });
});

describe('jetonDe', () => {
  it('fait l’aller-retour avec lireOrigine', () => {
    // C'est la seule chose qui garantit qu'un bouton de la grille tarifaire
    // produit bien l'origine que le SUPER_ADMIN lira.
    for (const origine of ORIGINES) {
      const jeton = jetonDe(origine);
      expect(lireOrigine(jeton ? `?${PARAMETRE_OFFRE}=${jeton}` : '')).toBe(origine);
    }
  });

  it('n’en donne aucun à DIRECT, qui n’est pas une offre', () => {
    expect(jetonDe('DIRECT')).toBeNull();
  });
});

describe('vocabulaire', () => {
  it('donne un libellé et un contexte à chaque origine', () => {
    // Un enum sans libellé afficherait sa valeur brute au SUPER_ADMIN.
    for (const origine of ORIGINES) {
      expect(LIBELLE_ORIGINE[origine]).toBeTruthy();
      expect(CONTEXTE_ORIGINE[origine]).toBeTruthy();
    }
  });

  it('ne met en avant que le programme fondateur', () => {
    // Quatre origines prioritaires n'en distingueraient aucune.
    expect(ORIGINES.filter(estPrioritaire)).toEqual(['PROGRAMME_FONDATEUR']);
  });
});

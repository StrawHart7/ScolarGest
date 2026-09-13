import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  deposer,
  prendreARejouer,
  FENETRE_REJEU_MS,
  MAX_DIFFERES,
  type SignalementDiffere,
} from '../signalement-differe';

/**
 * L'environnement de test est `node` : il n'y a ni `window` ni `localStorage`.
 * On en pose un minimal plutôt que de basculer le projet en `jsdom` pour un
 * seul fichier — et ça permet en prime d'éprouver le cas où le stockage
 * **lève**, qui est le vrai comportement d'une navigation privée.
 */
function poserStockage(options: { leve?: boolean } = {}) {
  const donnees = new Map<string, string>();
  const stockage = {
    getItem(cle: string) {
      if (options.leve) throw new Error('accès refusé');
      return donnees.get(cle) ?? null;
    },
    setItem(cle: string, valeur: string) {
      if (options.leve) throw new Error('quota dépassé');
      donnees.set(cle, valeur);
    },
    removeItem(cle: string) {
      if (options.leve) throw new Error('accès refusé');
      donnees.delete(cle);
    },
  };
  (globalThis as { window?: unknown }).window = { localStorage: stockage };
  return donnees;
}

function signalement(sur: Partial<SignalementDiffere> = {}): SignalementDiffere {
  return {
    nom: 'TypeError',
    chemin: '/etablissement/finances/factures/:id',
    reference: null,
    quand: Date.now(),
    ...sur,
  };
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe('dépôt des signalements différés', () => {
  beforeEach(() => {
    poserStockage();
  });

  it('rend ce qui a été déposé, puis vide le dépôt', () => {
    deposer(signalement());
    expect(prendreARejouer()).toHaveLength(1);
    // Le dépôt est vidé **avant** l'envoi : deux onglets qui reviennent en
    // ligne ensemble ne doivent pas compter l'incident deux fois.
    expect(prendreARejouer()).toHaveLength(0);
  });

  it('écarte le doublon exact', () => {
    // Une page en boucle hors ligne produit la même panne indéfiniment.
    deposer(signalement());
    deposer(signalement());
    deposer(signalement({ chemin: '/dashboard' }));
    expect(prendreARejouer()).toHaveLength(2);
  });

  it('ne garde que les derniers au-delà du plafond', () => {
    for (let i = 0; i < MAX_DIFFERES + 4; i += 1) {
      deposer(signalement({ chemin: `/page-${i}` }));
    }
    const retenus = prendreARejouer();
    expect(retenus).toHaveLength(MAX_DIFFERES);
    // Les plus récents, pas les premiers : une panne d'il y a dix minutes
    // renseigne mieux que la première d'une boucle.
    expect(retenus[retenus.length - 1]?.chemin).toBe(`/page-${MAX_DIFFERES + 3}`);
  });

  /**
   * Le compromis assumé : un signalement rejoué porte l'heure du rejeu, pas
   * celle de l'erreur. Passé une demi-journée, le laisser partir ferait croire
   * à un incident qui vient de se produire — on le jette.
   */
  it('jette ce qui est trop vieux, et vide quand même le dépôt', () => {
    const maintenant = Date.now();
    deposer(signalement({ quand: maintenant - FENETRE_REJEU_MS - 1, chemin: '/vieux' }));
    deposer(signalement({ quand: maintenant - 1000, chemin: '/recent' }));

    const retenus = prendreARejouer(maintenant);
    expect(retenus.map((s) => s.chemin)).toEqual(['/recent']);
    // Les périmés ne restent pas : sans cela on les réexaminerait à chaque
    // chargement de page, indéfiniment.
    expect(prendreARejouer(maintenant)).toHaveLength(0);
  });

  /**
   * Le contrôle qui compte le plus. Ce module est appelé depuis la page
   * d'erreur : s'il levait, il remplacerait l'erreur affichée par un écran
   * blanc — exactement la panne qu'il sert à signaler.
   */
  it('ne lève jamais quand le stockage est indisponible', () => {
    poserStockage({ leve: true });
    expect(() => deposer(signalement())).not.toThrow();
    expect(() => prendreARejouer()).not.toThrow();
    expect(prendreARejouer()).toEqual([]);
  });

  it('ne lève pas non plus côté serveur, où window n’existe pas', () => {
    delete (globalThis as { window?: unknown }).window;
    expect(() => deposer(signalement())).not.toThrow();
    expect(prendreARejouer()).toEqual([]);
  });

  it('ignore un contenu de stockage corrompu', () => {
    const donnees = poserStockage();
    donnees.set('scolargest.signalements-differes', 'ceci n’est pas du JSON');
    expect(prendreARejouer()).toEqual([]);

    donnees.set('scolargest.signalements-differes', JSON.stringify([{ nom: 42 }, null]));
    expect(prendreARejouer()).toEqual([]);
  });
});

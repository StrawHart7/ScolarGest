import { describe, expect, it } from 'vitest';
import {
  cheminSansParametres,
  decrireIncident,
  formaterIncident,
  messageIncident,
  sujetIncident,
  type ContexteIncident,
} from '../support-incident';

/** Un contexte complet, tel que le navigateur le produit. */
const CONTEXTE: ContexteIncident = {
  reference: 'a1b2c3d4',
  chemin: '/etablissement/finances/factures',
  message: "Cannot read properties of undefined (reading 'total')",
  survenuLe: '2026-09-08T09:30:00.000Z',
  horsLigne: false,
  ecran: '390x844',
  navigateur: 'Mozilla/5.0 (Linux; Android 13)',
  version: 'e36b183',
};

describe('cheminSansParametres', () => {
  // C'est la garantie de confidentialite du signalement, et elle est ecrite
  // ici plutot que confiee a une relecture : sur `/etablissement/eleves`, `?q=`
  // porte la recherche libre, c'est-a-dire le plus souvent un nom d'eleve.
  it("retire la query string, ou atterrit la recherche libre", () => {
    expect(cheminSansParametres('/etablissement/eleves?q=Kossi%20Amewu&page=2')).toBe(
      '/etablissement/eleves',
    );
  });

  it('retire aussi le fragment', () => {
    expect(cheminSansParametres('/etablissement/classes#section-3')).toBe(
      '/etablissement/classes',
    );
  });

  it('retire la query string même derrière un fragment', () => {
    expect(cheminSansParametres('/rapports#bloc?q=secret')).toBe('/rapports');
  });

  it('rend « / » sur une chaîne vide plutôt que rien', () => {
    expect(cheminSansParametres('')).toBe('/');
  });

  it('borne la longueur', () => {
    expect(cheminSansParametres(`/${'a'.repeat(500)}`).length).toBeLessThanOrEqual(200);
  });
});

describe('decrireIncident', () => {
  it('ne lève pas sans `window` ni `navigator`', () => {
    // La page d'erreur est le dernier endroit ou une exception est acceptable :
    // elle sert deja a signaler une exception.
    expect(() => decrireIncident({ message: 'boum', digest: 'ref' })).not.toThrow();
  });

  it('remplace un message absent plutôt que de rendre `undefined`', () => {
    expect(decrireIncident({}).message).toBe('Message non transmis.');
  });

  it('borne un message technique interminable', () => {
    const contexte = decrireIncident({ message: 'x'.repeat(5000) });
    expect(contexte.message.length).toBeLessThanOrEqual(501);
  });
});

describe('formaterIncident', () => {
  it('porte la référence, la page et le message technique', () => {
    const bloc = formaterIncident(CONTEXTE);
    expect(bloc).toContain('Reference : a1b2c3d4');
    expect(bloc).toContain('Page : /etablissement/finances/factures');
    expect(bloc).toContain("Cannot read properties of undefined");
  });

  it('dit « aucune » plutôt que de laisser un trou quand il n’y a pas de référence', () => {
    expect(formaterIncident({ ...CONTEXTE, reference: null })).toContain('Reference : aucune');
  });

  it('omet les lignes absentes au lieu d’écrire « null »', () => {
    const bloc = formaterIncident({ ...CONTEXTE, ecran: null, navigateur: null, version: null });
    expect(bloc).not.toContain('null');
    expect(bloc).not.toContain('Ecran');
  });
});

describe('messageIncident', () => {
  it('met la phrase de l’utilisateur avant le bloc technique', () => {
    const message = messageIncident(CONTEXTE, "J'enregistrais un versement.");
    expect(message.indexOf("J'enregistrais un versement.")).toBeLessThan(
      message.indexOf('Contexte technique'),
    );
  });

  it('le dit explicitement quand personne n’a rien écrit', () => {
    expect(messageIncident(CONTEXTE, '   ')).toContain('sans description');
  });

  it('tient dans les 4000 caractères du schéma d’envoi, même au maximum', () => {
    // Le schema borne le message a 4000 caracteres. Un `userAgent` exotique et
    // une pile d'appels ne doivent pas faire refuser le signalement au moment
    // ou il est le plus utile.
    const gonfle: ContexteIncident = {
      ...CONTEXTE,
      message: 'x'.repeat(500),
      navigateur: 'y'.repeat(200),
      chemin: '/'.padEnd(200, 'z'),
      reference: 'r'.repeat(100),
    };
    expect(messageIncident(gonfle, 'd'.repeat(2000)).length).toBeLessThanOrEqual(4000);
  });
});

describe('sujetIncident', () => {
  it('reprend la référence, seul point commun avec les logs serveur', () => {
    expect(sujetIncident(CONTEXTE)).toContain('a1b2c3d4');
  });

  it('se rabat sur la page quand il n’y a pas de référence', () => {
    expect(sujetIncident({ ...CONTEXTE, reference: null })).toContain(
      '/etablissement/finances/factures',
    );
  });

  it('respecte les bornes du schéma d’envoi (5 à 150)', () => {
    const long = sujetIncident({ ...CONTEXTE, reference: 'r'.repeat(100) });
    expect(long.length).toBeLessThanOrEqual(150);
    expect(sujetIncident({ ...CONTEXTE, reference: null, chemin: '/' }).length).toBeGreaterThan(5);
  });
});

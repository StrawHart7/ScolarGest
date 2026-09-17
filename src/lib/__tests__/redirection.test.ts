/**
 * La destination d'après authentification ne doit jamais quitter le domaine.
 *
 * Ces cas ne sont pas theoriques : `/auth/callback` construisait sa
 * destination par concatenation, `${urlApplication()}${next}`, et
 * `urlApplication()` retire les barres finales. La forme `@hote` suffisait
 * donc a emmener un utilisateur qui vient de s'authentifier chez un tiers.
 */
import { describe, expect, it } from 'vitest';
import { destinationInterne } from '../redirection';

const DEFAUT = '/dashboard';

describe('destinationInterne', () => {
  it('garde un chemin interne ordinaire', () => {
    expect(destinationInterne('/etablissement/eleves', DEFAUT)).toBe('/etablissement/eleves');
  });

  it('garde un chemin interne portant une chaine de requete', () => {
    expect(destinationInterne('/rapports?type=finance', DEFAUT)).toBe('/rapports?type=finance');
  });

  it('rend le defaut quand rien n est demande', () => {
    expect(destinationInterne(null, DEFAUT)).toBe(DEFAUT);
    expect(destinationInterne(undefined, DEFAUT)).toBe(DEFAUT);
    expect(destinationInterne('', DEFAUT)).toBe(DEFAUT);
  });

  /**
   * Le cas qui a motive tout ce fichier. Concatene a `https://scolargest.com`,
   * `@evil.com` donne `https://scolargest.com@evil.com` : l'hote est
   * `evil.com`, et `scolargest.com` n'est plus qu'un identifiant
   * d'utilisateur. Un controle qui ne chercherait que `//` le laisse passer.
   */
  it('refuse la forme identifiant, qui change d hote sans aucune barre', () => {
    expect(destinationInterne('@evil.com', DEFAUT)).toBe(DEFAUT);
    expect(destinationInterne('@evil.com/connexion', DEFAUT)).toBe(DEFAUT);
  });

  it('refuse une URL absolue', () => {
    expect(destinationInterne('https://evil.com', DEFAUT)).toBe(DEFAUT);
    expect(destinationInterne('http://evil.com', DEFAUT)).toBe(DEFAUT);
    expect(destinationInterne('javascript:alert(1)', DEFAUT)).toBe(DEFAUT);
  });

  it('refuse le protocole-relatif', () => {
    expect(destinationInterne('//evil.com', DEFAUT)).toBe(DEFAUT);
  });

  /**
   * Les navigateurs normalisent la barre inversee en barre : `/\evil.com`
   * devient `//evil.com`, donc un changement d'hote. C'est le contournement
   * habituel d'un controle qui ne regarde que `//`.
   */
  it('refuse la barre inversee, que le navigateur normalise en barre', () => {
    expect(destinationInterne('/\\evil.com', DEFAUT)).toBe(DEFAUT);
  });

  it('refuse un chemin relatif, qui ne dit pas ou il mene', () => {
    expect(destinationInterne('dashboard', DEFAUT)).toBe(DEFAUT);
    expect(destinationInterne('../admin', DEFAUT)).toBe(DEFAUT);
  });
});

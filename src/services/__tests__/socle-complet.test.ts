import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * `socleComplet` décide si « Configuration » reste dans la barre de la section
 * Établissement. Les deux sens de l'erreur ne coûtent pas la même chose :
 *
 * - rendre `false` à tort affiche une entrée de trop ;
 * - rendre `true` à tort **retire le seul chemin** vers ce qui reste à régler,
 *   et le retire précisément à l'école qui n'a pas fini de se configurer.
 *
 * D'où le repli sur `false` quand la lecture échoue, et d'où ce test : c'est
 * une garantie de sûreté, pas un détail d'affichage.
 */

const mockRequireRole = vi.fn();
vi.mock('../authorization', () => ({
  requireRole: (...roles: string[]) => mockRequireRole(...roles),
}));

const mockDiagnostiquer = vi.fn();
vi.mock('../conseils', () => ({
  diagnostiquer: () => mockDiagnostiquer(),
}));

import { socleComplet, etatSocle } from '../configuration';
import { CATALOGUE } from '@/lib/conseils/catalogue';

/** Les sondes dont dépendent les entrées « indispensables » du catalogue. */
const SONDES_REQUISES = CATALOGUE.filter((c) => c.socle === 'REQUIS')
  .map((c) => c.sonde)
  .filter((s): s is NonNullable<typeof s> => Boolean(s));

/** Un diagnostic où toutes les sondes du catalogue sont satisfaites. */
function diagnosticComplet(): Record<string, { fait: number; total: number }> {
  const complet: Record<string, { fait: number; total: number }> = {};
  for (const conseil of CATALOGUE) {
    if (conseil.sonde) complet[conseil.sonde] = { fait: 1, total: 1 };
  }
  return complet;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireRole.mockResolvedValue({ role: 'DIRECTEUR', etablissementId: 'e1', userId: 'u1' });
});

describe('socleComplet', () => {
  it('le catalogue porte bien des entrées indispensables à sonder', () => {
    // Sans cette garde, les deux tests suivants passeraient sur un catalogue
    // vide en ne prouvant rien.
    expect(SONDES_REQUISES.length).toBeGreaterThan(0);
  });

  it('rend vrai quand tous les réglages indispensables sont faits', async () => {
    mockDiagnostiquer.mockResolvedValue(diagnosticComplet());

    await expect(socleComplet()).resolves.toBe(true);
  });

  it('rend faux dès qu’un seul réglage indispensable manque', async () => {
    const diagnostic = diagnosticComplet();
    diagnostic[SONDES_REQUISES[0]!] = { fait: 0, total: 3 };
    mockDiagnostiquer.mockResolvedValue(diagnostic);

    await expect(socleComplet()).resolves.toBe(false);
  });

  it('rend faux — et ne lève pas — quand la lecture échoue', async () => {
    // Les erreurs Supabase ne sont pas des `Error` : on lève ici un objet nu,
    // comme les services le font (`if (error) throw error`).
    mockDiagnostiquer.mockRejectedValue({ message: '', code: 'SG_HTTP_500' });

    await expect(socleComplet()).resolves.toBe(false);
  });

  it('laisse `etatSocle` lever : c’est l’écran de configuration qui décide', async () => {
    // La tolérance appartient à `socleComplet`, dont l'appelant est une barre
    // de navigation. L'écran de configuration, lui, n'a rien à afficher sans
    // son socle : l'avaler lui ferait annoncer « 0 sur 9 » à une école
    // parfaitement configurée.
    mockDiagnostiquer.mockRejectedValue({ message: 'panne' });

    await expect(etatSocle()).rejects.toBeDefined();
  });
});

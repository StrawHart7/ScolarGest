import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * `etatSocle` répond à deux questions que l'écran de configuration pose, et
 * qu'il ne faut pas confondre :
 *
 * - `complet` — « l'école peut-elle facturer et éditer un bulletin ? » ;
 * - `toutFait` — « reste-t-il quoi que ce soit à régler ou à découvrir ? ».
 *
 * Une école peut être `complet` sans logo ni filigrane pendant des mois. C'est
 * `toutFait` qui déclenche l'écran « tout est réglé », d'où ce test : s'il
 * basculait sur `complet`, une école verrait « vous n'avez rien à faire »
 * alors qu'il lui reste des réglages facultatifs listés juste en dessous.
 *
 * `socleComplet` a été supprimée le 2026-09-16 avec l'exclusion de
 * « Configuration » de la rangée d'Établissement — voir le commentaire laissé
 * à sa place dans `configuration.ts`. Son test disparaît avec elle.
 */

const mockRequireRole = vi.fn();
vi.mock('../authorization', () => ({
  requireRole: (...roles: string[]) => mockRequireRole(...roles),
}));

const mockDiagnostiquer = vi.fn();
vi.mock('../conseils', () => ({
  diagnostiquer: () => mockDiagnostiquer(),
}));

/** Date de création du compte, réglée par test. */
let compteCreeLe: string | null = '2020-01-01T00:00:00.000Z';
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: compteCreeLe ? { createdAt: compteCreeLe } : null,
            error: null,
          }),
        }),
      }),
    }),
  }),
}));

import { etatSocle } from '../configuration';
import { CATALOGUE } from '@/lib/conseils/catalogue';

const REQUIS = CATALOGUE.filter((c) => c.socle === 'REQUIS');
const RECOMMANDES = CATALOGUE.filter((c) => c.socle === 'RECOMMANDE');
const AVEC_NOUVEAUTE = CATALOGUE.filter((c) => c.nouveaute);

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
  compteCreeLe = '2020-01-01T00:00:00.000Z';
  mockRequireRole.mockResolvedValue({ role: 'DIRECTEUR', etablissementId: 'e1', userId: 'u1' });
});

describe('le catalogue porte de quoi éprouver ce test', () => {
  it('a des entrées indispensables, recommandées, et des nouveautés', () => {
    // Sans cette garde, tout ce qui suit passerait sur des listes vides en ne
    // prouvant rien — le piège déjà consigné pour la sonde de sécurité.
    expect(REQUIS.length).toBeGreaterThan(0);
    expect(RECOMMANDES.length).toBeGreaterThan(0);
    expect(AVEC_NOUVEAUTE.length).toBeGreaterThan(0);
  });
});

describe('complet et toutFait ne sont pas la même chose', () => {
  it('tout coché : les deux sont vrais', async () => {
    mockDiagnostiquer.mockResolvedValue(diagnosticComplet());
    const socle = await etatSocle();
    expect(socle.complet).toBe(true);
    expect(socle.toutFait).toBe(true);
  });

  it('un recommandé manquant : complet reste vrai, toutFait devient faux', async () => {
    // C'est le cas qui distingue les deux, et celui qui décide de l'écran.
    const diagnostic = diagnosticComplet();
    const sonde = RECOMMANDES.find((c) => c.sonde)?.sonde;
    expect(sonde).toBeTruthy();
    diagnostic[sonde!] = { fait: 0, total: 1 };
    mockDiagnostiquer.mockResolvedValue(diagnostic);

    const socle = await etatSocle();
    expect(socle.complet).toBe(true);
    expect(socle.toutFait).toBe(false);
  });

  it('un indispensable manquant : les deux sont faux', async () => {
    const diagnostic = diagnosticComplet();
    diagnostic[REQUIS.find((c) => c.sonde)!.sonde!] = { fait: 0, total: 3 };
    mockDiagnostiquer.mockResolvedValue(diagnostic);

    const socle = await etatSocle();
    expect(socle.complet).toBe(false);
    expect(socle.toutFait).toBe(false);
  });
});

describe('nouveautés', () => {
  it('propose ce qui est apparu après la création du compte et reste à faire', async () => {
    const diagnostic = diagnosticComplet();
    const nouveaute = AVEC_NOUVEAUTE.find((c) => c.sonde && c.roles.includes('DIRECTEUR'));
    expect(nouveaute).toBeTruthy();
    diagnostic[nouveaute!.sonde!] = { fait: 0, total: 5 };
    mockDiagnostiquer.mockResolvedValue(diagnostic);

    const socle = await etatSocle();
    expect(socle.nouveautes.map((n) => n.id)).toContain(nouveaute!.id);
  });

  it('n’annonce rien de neuf à un compte créé après la fonctionnalité', async () => {
    // Pour lui, elle a toujours existé. L'annoncer comme neuve serait faux —
    // même règle que `choisirConseil`.
    compteCreeLe = '2030-01-01T00:00:00.000Z';
    const diagnostic = diagnosticComplet();
    for (const c of AVEC_NOUVEAUTE) {
      if (c.sonde) diagnostic[c.sonde] = { fait: 0, total: 5 };
    }
    mockDiagnostiquer.mockResolvedValue(diagnostic);

    expect((await etatSocle()).nouveautes).toEqual([]);
  });

  it('retire une nouveauté dès qu’elle est utilisée', async () => {
    // Ce n'est pas un journal des versions : c'est ce qu'il reste à découvrir.
    mockDiagnostiquer.mockResolvedValue(diagnosticComplet());
    expect((await etatSocle()).nouveautes).toEqual([]);
  });

  it('se tait quand la date de création du compte est introuvable', async () => {
    // Sans elle, impossible de dire si c'est une nouveauté. Annoncer tout le
    // catalogue comme neuf à quelqu'un dont on ne sait rien serait pire que se
    // taire.
    compteCreeLe = null;
    const diagnostic = diagnosticComplet();
    for (const c of AVEC_NOUVEAUTE) {
      if (c.sonde) diagnostic[c.sonde] = { fait: 0, total: 5 };
    }
    mockDiagnostiquer.mockResolvedValue(diagnostic);

    expect((await etatSocle()).nouveautes).toEqual([]);
  });
});

describe('échec de lecture', () => {
  it('laisse lever : l’écran n’a rien à afficher sans son socle', async () => {
    // L'avaler ferait annoncer « 0 sur 9 » à une école parfaitement
    // configurée. Les erreurs Supabase ne sont pas des `Error` : on lève un
    // objet nu, comme les services le font.
    mockDiagnostiquer.mockRejectedValue({ message: 'panne', code: 'SG_HTTP_500' });
    await expect(etatSocle()).rejects.toBeDefined();
  });
});

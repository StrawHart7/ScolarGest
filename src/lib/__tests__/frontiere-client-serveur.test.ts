import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

/**
 * Un composant serveur n'importe jamais une **valeur** depuis un module
 * `'use client'`.
 *
 * ## La panne, constatée le 2026-09-15 en preview
 *
 * `COOKIE_BANDEAU_ABONNEMENT` et `jourCourant()` vivaient dans
 * `BandeauMasquable.tsx`, marqué `'use client'`. `AbonnementBanner` — un
 * composant **serveur** — les importait.
 *
 * Dans l'App Router, un module `'use client'` importé par le serveur n'expose
 * pas ses valeurs : il expose des **références client**. Appeler
 * `jourCourant()` depuis le serveur lève, et la constante n'est pas une
 * chaîne. Comme `AbonnementBanner` est monté dans `AppLayout`, **toutes** les
 * pages de l'espace école tombaient. Le journal Vercel montrait un statut 0
 * sur `/dashboard`, sans pile — la fonction s'arrêtait en plein flux.
 *
 * Ni `tsc` ni ESLint ne voient cette frontière : le type est juste des deux
 * côtés, et l'import est syntaxiquement valide. C'est la sœur jumelle de la
 * règle déjà documentée — « un composant client n'importe jamais depuis
 * `src/services/` » — à ceci près que celle-ci tombe à l'exécution au lieu de
 * casser le build.
 *
 * ## Ce que le test autorise
 *
 * **Les composants.** Un composant client importé par le serveur est le cas
 * normal : il est rendu en JSX, pas appelé. On les reconnaît à leur nom en
 * PascalCase — `BandeauMasquable`, `RegimeProvider`.
 *
 * **Les types.** `import type { … }` est effacé à la compilation : il ne
 * traverse aucune frontière.
 *
 * Tout le reste — constantes, fonctions utilitaires, hooks — doit vivre dans un
 * module sans directive, que les deux côtés importent. C'est la parade déjà
 * employée par `lib/emploi-du-temps.ts`, `lib/support.ts`, `lib/periodes.ts`.
 */

const RACINE = join(process.cwd(), 'src');

function fichiers(dossier: string): string[] {
  const trouves: string[] = [];
  for (const entree of readdirSync(dossier)) {
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) {
      if (entree === '__tests__') continue;
      trouves.push(...fichiers(chemin));
    } else if (/\.tsx?$/.test(entree)) {
      trouves.push(chemin);
    }
  }
  return trouves;
}

/** La directive doit être la première instruction du module. */
function estClient(source: string): boolean {
  return /^\s*(\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*['"]use client['"]/.test(source);
}

/**
 * Un nom de composant : PascalCase sans souligné.
 *
 * `COOKIE_BANDEAU_ABONNEMENT` commence par une majuscule mais n'est pas un
 * composant — c'est exactement la constante qui a causé la panne. Le souligné
 * la distingue.
 */
function estComposant(nom: string): boolean {
  return /^[A-Z][A-Za-z0-9]*$/.test(nom) && nom !== nom.toUpperCase();
}

/** Exports de valeur d'un module, hors `type` et `interface`. */
function exportsDeValeur(source: string): string[] {
  const noms: string[] = [];
  for (const [, nom] of source.matchAll(
    /^export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z0-9_$]+)/gm,
  )) {
    if (nom) noms.push(nom);
  }
  return noms;
}

/** Résout un chemin d'import vers un fichier du dépôt, ou `null`. */
function resoudre(depuis: string, specifieur: string): string | null {
  let base: string;
  if (specifieur.startsWith('@/')) base = join(RACINE, specifieur.slice(2));
  else if (specifieur.startsWith('.')) base = resolve(dirname(depuis), specifieur);
  else return null;

  for (const candidat of [
    `${base}.ts`,
    `${base}.tsx`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
  ]) {
    if (existsSync(candidat) && statSync(candidat).isFile()) return candidat;
  }
  return null;
}

interface Import {
  specifieur: string;
  noms: string[];
  typeSeul: boolean;
}

function importsDe(source: string): Import[] {
  const trouves: Import[] = [];
  for (const [, marqueType, accolades, specifieur] of source.matchAll(
    /import\s+(type\s+)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g,
  )) {
    if (!accolades || !specifieur) continue;
    const noms = accolades
      .split(',')
      .map((morceau) => morceau.trim())
      // `type X` dans une liste mixte : effacé lui aussi.
      .filter((morceau) => morceau !== '' && !morceau.startsWith('type '))
      // `X as Y` : c'est `X` qui est importé.
      .map((morceau) => (morceau.split(/\s+as\s+/)[0] ?? '').trim())
      .filter(Boolean);
    trouves.push({ specifieur, noms, typeSeul: Boolean(marqueType) });
  }
  return trouves;
}

describe('frontière client / serveur', () => {
  const tous = fichiers(RACINE);
  const sources = new Map(tous.map((f) => [f, readFileSync(f, 'utf8')]));

  it('reconnaît une directive « use client », et ne la confond pas', () => {
    // Garde-fou du test : sans cette détection, tout passerait.
    expect(estClient("'use client';\nexport const a = 1;")).toBe(true);
    expect(estClient('// un commentaire\n"use client";\n')).toBe(true);
    expect(estClient("export const a = 'use client';")).toBe(false);
    expect(estClient('')).toBe(false);
  });

  it('distingue un composant d’une constante', () => {
    expect(estComposant('BandeauMasquable')).toBe(true);
    expect(estComposant('RegimeProvider')).toBe(true);
    // Le cas exact de la panne : majuscule, mais pas un composant.
    expect(estComposant('COOKIE_BANDEAU_ABONNEMENT')).toBe(false);
    expect(estComposant('jourCourant')).toBe(false);
    expect(estComposant('usePeriodes')).toBe(false);
  });

  it('trouve bien des modules client à confronter', () => {
    const clients = tous.filter((f) => estClient(sources.get(f) ?? ''));
    expect(clients.length, 'aucun module client trouvé : le test ne vérifie rien').toBeGreaterThan(
      20,
    );
  });

  it('aucun module serveur n’importe une valeur depuis un module client', () => {
    const fautives: string[] = [];

    for (const fichier of tous) {
      const source = sources.get(fichier) ?? '';
      if (estClient(source)) continue; // Client → client : sans objet.

      for (const imp of importsDe(source)) {
        if (imp.typeSeul) continue;
        const cible = resoudre(fichier, imp.specifieur);
        if (!cible) continue;
        const sourceCible = sources.get(cible) ?? '';
        if (!estClient(sourceCible)) continue;

        const valeurs = new Set(exportsDeValeur(sourceCible));
        for (const nom of imp.noms) {
          // Un composant traverse : il est rendu, pas appelé.
          if (estComposant(nom)) continue;
          if (!valeurs.has(nom)) continue;
          fautives.push(
            `${fichier.replace(process.cwd(), '')} importe « ${nom} » depuis ${imp.specifieur} (module client)`,
          );
        }
      }
    }

    expect(
      [...new Set(fautives)],
      'sur le serveur, ces exports ne sont pas des valeurs mais des références client : les appeler lève, et toute page qui les atteint tombe',
    ).toEqual([]);
  });
});

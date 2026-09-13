import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { statSync } from 'node:fs';
import {
  CLES_META,
  LONGUEUR_MAX_VALEUR,
  LONGUEUR_MAX_ROUTE,
  nettoyerMeta,
  normaliserRoute,
} from '../telemetrie';

/**
 * Le vocabulaire de la télémétrie existe à deux endroits : ici en TypeScript,
 * et dans `controle.meta_sans_contenu` en SQL. La base a le dernier mot — une
 * clé absente de sa liste fait échouer l'insertion par contrainte `CHECK`.
 *
 * Deux copies d'une même règle finissent toujours par diverger, et celle-ci
 * divergerait **en silence** : le code accepterait une clé que la base
 * refuserait, et l'événement serait simplement perdu. Ce test lit donc la
 * migration réelle plutôt qu'une copie — même parti pris que
 * `src/lib/offline/__tests__/service-worker.test.ts`, qui éprouve les
 * expressions de `public/sw.js` telles qu'elles y sont écrites.
 */
function lireMigrationSocle(): string {
  const dossier = join(__dirname, '..', '..', '..', 'supabase', 'migrations');
  const fichier = readdirSync(dossier).find((f) => f.endsWith('_socle_regie.sql'));
  if (!fichier) throw new Error('Migration `_socle_regie.sql` introuvable.');
  return readFileSync(join(dossier, fichier), 'utf8');
}

describe('vocabulaire de la télémétrie', () => {
  it('correspond exactement à celui de controle.meta_sans_contenu', () => {
    const sql = lireMigrationSocle();

    // Le corps de la fonction, entre `cle in (` et la parenthèse fermante.
    const debut = sql.indexOf('create or replace function controle.meta_sans_contenu');
    expect(debut).toBeGreaterThan(-1);
    const bloc = sql.slice(debut, sql.indexOf('$fn$;', debut));

    const liste = bloc.slice(bloc.indexOf('cle in ('), bloc.indexOf(')', bloc.indexOf('cle in (')));
    const clesSql = [...liste.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();

    expect(clesSql.length).toBeGreaterThan(0);
    expect(clesSql).toEqual([...CLES_META].sort());
  });

  it('borne les chaînes à la même longueur que la base', () => {
    const sql = lireMigrationSocle();
    expect(sql).toContain(`<= ${LONGUEUR_MAX_VALEUR}`);
  });
});

describe('nettoyerMeta', () => {
  it('laisse passer un meta conforme', () => {
    expect(nettoyerMeta({ route: '/etablissement/notes', nombre: 12, statut: 'ok' })).toEqual({
      meta: { route: '/etablissement/notes', nombre: 12, statut: 'ok' },
      rejets: [],
    });
  });

  it('écarte une clé hors vocabulaire plutôt que de faire échouer la requête', () => {
    // C'est le cas qui compte : sans ce filtre, la contrainte `CHECK` de la
    // base refuserait la ligne entière, et l'événement serait perdu sans que
    // l'appelant sache pourquoi.
    const { meta, rejets } = nettoyerMeta({ nomEleve: 'Kossi A.' } as never);
    expect(meta).toEqual({});
    expect(rejets).toHaveLength(1);
  });

  it('écarte une chaîne trop longue — c\'est elle qui transporterait un nom', () => {
    const { meta, rejets } = nettoyerMeta({ entite: 'x'.repeat(LONGUEUR_MAX_VALEUR + 1) });
    expect(meta).toEqual({});
    expect(rejets[0]).toContain('trop longue');
  });

  it('écarte une valeur non scalaire', () => {
    const { meta, rejets } = nettoyerMeta({ code: { id: 1 } } as never);
    expect(meta).toEqual({});
    expect(rejets[0]).toContain('non scalaire');
  });

  it('ignore undefined et null sans les compter comme des rejets', () => {
    // Un appelant écrit volontiers `{ serie: classe.serieId ?? undefined }` :
    // ce n'est pas une faute, et le signaler noierait les vrais rejets.
    expect(nettoyerMeta({ serie: undefined, niveau: null as never })).toEqual({
      meta: {},
      rejets: [],
    });
  });
});

/**
 * Toutes les routes statiques de l'application, reconstruites depuis
 * l'arborescence de `src/app`.
 *
 * Les groupes `(auth)` ne figurent pas dans l'URL ; les segments dynamiques
 * `[id]` portent un identifiant et sont exclus, c'est précisément ce que
 * `normaliserRoute` doit masquer.
 */
function routesStatiques(): string[] {
  const racine = join(__dirname, '..', '..', 'app');
  const routes: string[] = [];

  function parcourir(dossier: string, prefixe: string): void {
    for (const entree of readdirSync(dossier)) {
      const complet = join(dossier, entree);
      if (!statSync(complet).isDirectory()) continue;
      // Un segment dynamique porte un identifiant : hors sujet ici.
      if (entree.startsWith('[')) continue;
      // Un groupe de routes n'apparaît pas dans l'URL.
      const segment = entree.startsWith('(') && entree.endsWith(')') ? '' : `/${entree}`;
      const chemin = `${prefixe}${segment}`;
      if (readdirSync(complet).includes('page.tsx') && chemin !== '') routes.push(chemin);
      parcourir(complet, chemin);
    }
  }

  parcourir(racine, '');
  return routes;
}

describe('normalisation des routes', () => {
  /**
   * Le contrôle qui compte. La liste blanche est calibrée sur les routes
   * réelles de ce dépôt : si quelqu'un crée demain un `/rapports/2026`, la
   * route partirait à la Régie sous `/rapports/:id` et l'écran « Erreurs »
   * deviendrait illisible sans que rien ne le signale. Le test lit
   * l'arborescence réelle plutôt qu'une liste recopiée, pour la même raison
   * que le vocabulaire est lu dans la migration.
   */
  it("laisse intactes toutes les routes statiques de l'application", () => {
    const routes = routesStatiques();
    // Contrôle positif : si le parcours ne trouve rien, le test passerait sans
    // rien éprouver. Le dépôt en compte plusieurs dizaines.
    expect(routes.length).toBeGreaterThan(20);

    const deformees = routes.filter((route) => normaliserRoute(route) !== route);
    expect(deformees).toEqual([]);
  });

  it('masque un identifiant, quelle que soit sa forme', () => {
    expect(normaliserRoute('/etablissement/eleves/3f8a1c92-4b7e-4f21-9c3d-8e1f0a2b6d45')).toBe(
      '/etablissement/eleves/:id',
    );
    expect(normaliserRoute('/utilisateurs/42')).toBe('/utilisateurs/:id');
    expect(normaliserRoute('/etablissement/notes/saisie/EVAL-2026-0007')).toBe(
      '/etablissement/notes/saisie/:id',
    );
  });

  /**
   * Le cas qui a décidé du sens de la règle. Un segment inattendu n'est pas un
   * identifiant reconnaissable ; une liste noire le laisserait passer tel quel,
   * et un nom d'élève partirait dans le plan de contrôle.
   */
  it('masque aussi ce qui ne ressemble à aucun identifiant connu', () => {
    expect(normaliserRoute('/etablissement/eleves/Jean%20Dupont')).toBe(
      '/etablissement/eleves/:id',
    );
    expect(normaliserRoute('/etablissement/eleves/KOSSI Ama')).toBe('/etablissement/eleves/:id');
  });

  it('retire la query string, qui porte la recherche libre', () => {
    // `?q=` sur une liste d'élèves contient le plus souvent un nom.
    expect(normaliserRoute('/etablissement/eleves?q=Kossi')).toBe('/etablissement/eleves');
    expect(normaliserRoute('/rapports#section')).toBe('/rapports');
  });

  /**
   * Le service normalise de nouveau ce que le client a déjà normalisé : l'entrée
   * vient de l'appelant, donc elle ne se croit pas. Une seconde passe ne doit
   * rien changer, sans quoi `:id` deviendrait `:id` de `:id` et l'empreinte
   * d'un même défaut changerait selon le chemin emprunté.
   */
  it('est idempotente', () => {
    const une = normaliserRoute('/etablissement/classes/3f8a1c92-4b7e-4f21-9c3d-8e1f0a2b6d45');
    expect(normaliserRoute(une)).toBe(une);
  });

  it("borne la longueur et tolère l'absence de chemin", () => {
    expect(normaliserRoute(normaliserRoute(`/${'a'.repeat(400)}`)).length).toBeLessThanOrEqual(
      LONGUEUR_MAX_ROUTE,
    );
    expect(normaliserRoute('')).toBe('/');
    expect(normaliserRoute('/')).toBe('/');
    expect(normaliserRoute(null)).toBe('/');
    expect(normaliserRoute(undefined)).toBe('/');
  });
});

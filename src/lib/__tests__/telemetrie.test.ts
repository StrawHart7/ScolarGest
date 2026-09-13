import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { CLES_META, LONGUEUR_MAX_VALEUR, nettoyerMeta } from '../telemetrie';

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

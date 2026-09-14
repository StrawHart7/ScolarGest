import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { CODES_DRAPEAUX, DRAPEAUX } from '../drapeaux';

/**
 * Le code d'un drapeau est une clé, et une clé fausse ne fait pas de bruit.
 *
 * `public.drapeau_actif` rend `false` quand elle ne trouve pas la ligne. Une
 * faute de frappe dans `src/lib/drapeaux.ts` ne casserait donc ni le build, ni
 * le typage, ni aucun test d'intégration : elle couperait la fonctionnalité
 * pour toutes les écoles, en silence, et la panne se découvrirait sur un
 * bulletin sans coefficients.
 *
 * Ce test lit les migrations **réelles** plutôt qu'une liste recopiée — une
 * copie divergerait le jour où l'on ajoute un drapeau, ce qui est exactement le
 * jour où le contrôle devrait servir. Même méthode que
 * `src/lib/offline/__tests__/service-worker.test.ts`, qui éprouve les
 * expressions de `public/sw.js` telles qu'elles y sont écrites.
 */

const DOSSIER_MIGRATIONS = join(process.cwd(), 'supabase', 'migrations');

/** Les codes semés par les migrations, dans l'ordre où on les y trouve. */
function codesSemes(): string[] {
  const codes: string[] = [];
  for (const fichier of readdirSync(DOSSIER_MIGRATIONS).filter((f) => f.endsWith('.sql'))) {
    const sql = readFileSync(join(DOSSIER_MIGRATIONS, fichier), 'utf8');
    // Chaque `insert into public.drapeau ... values` jusqu'au `;` qui le clôt :
    // découper sur le point-virgule évite de ramasser les codes d'un autre
    // ordre plus bas dans le même fichier.
    for (const morceau of sql.split(/insert\s+into\s+public\.drapeau\b/i).slice(1)) {
      const valeurs = morceau.split(';')[0] ?? '';
      for (const [, code] of valeurs.matchAll(/\(\s*'([^']+)'/g)) if (code) codes.push(code);
    }
  }
  return codes;
}

describe('les drapeaux du produit', () => {
  it('trouve au moins un drapeau semé dans les migrations', () => {
    // Garde-fou du test lui-même : si l'extraction cassait, tout le reste
    // passerait sur un tableau vide et ne vérifierait plus rien.
    expect(codesSemes().length).toBeGreaterThan(0);
  });

  it('ne nomme que des codes réellement présents en base', () => {
    const semes = codesSemes();
    for (const code of CODES_DRAPEAUX) {
      expect(semes, `le drapeau « ${code} » n'est semé par aucune migration`).toContain(code);
    }
  });

  it('emploie la casse exacte de la base', () => {
    // La Régie affiche les codes en capitales — c'est du style, et
    // `drapeau_actif` compare la casse : « REFERENTIEL_NATIONAL » ne trouverait
    // aucune ligne et rendrait false pour toutes les écoles.
    for (const code of CODES_DRAPEAUX) expect(code).toBe(code.toLowerCase());
  });

  it('ne déclare pas deux fois le même code', () => {
    expect(new Set(CODES_DRAPEAUX).size).toBe(CODES_DRAPEAUX.length);
  });

  it('expose le drapeau du référentiel national', () => {
    expect(DRAPEAUX.REFERENTIEL_NATIONAL).toBe('referentiel_national');
  });
});

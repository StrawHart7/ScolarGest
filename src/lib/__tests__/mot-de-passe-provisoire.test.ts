import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Le nom du marqueur `app_metadata` est écrit **deux fois** : dans
 * `services/utilisateur.ts`, qui le pose, et dans `lib/supabase/middleware.ts`,
 * qui le lit.
 *
 * C'est délibéré — le middleware tourne sur chaque requête et importer le
 * service y ferait entrer `next/headers` et la moitié du domaine dans le
 * runtime edge. Mais une chaîne recopiée finit par diverger, et ici la
 * divergence est silencieuse : le marqueur serait posé et jamais lu, donc
 * aucun enseignant ne serait plus jamais invité à changer son mot de passe,
 * sans la moindre erreur nulle part.
 *
 * Les fichiers sont lus tels qu'ils sont sur le disque plutôt qu'importés :
 * importer le middleware tirerait `@supabase/ssr` et le graphe qu'on cherche
 * justement à ne pas charger.
 */

const RACINE = join(process.cwd(), 'src');

function valeurDeLaConstante(chemin: string): string | null {
  const source = readFileSync(join(RACINE, chemin), 'utf8');
  const trouve = source.match(
    /CLAIM_MOT_DE_PASSE_PROVISOIRE\s*=\s*['"]([a-z_]+)['"]/,
  );
  return trouve?.[1] ?? null;
}

describe('le marqueur de mot de passe provisoire', () => {
  it('porte le même nom des deux côtés', () => {
    const service = valeurDeLaConstante('services/utilisateur.ts');
    const middleware = valeurDeLaConstante('lib/supabase/middleware.ts');

    // Garde-fou du test : si la lecture cassait, deux `null` seraient égaux et
    // le test passerait sans rien vérifier.
    expect(service, 'constante introuvable dans services/utilisateur.ts').not.toBeNull();
    expect(middleware, 'constante introuvable dans lib/supabase/middleware.ts').not.toBeNull();
    expect(middleware).toBe(service);
  });

  it('est bien posé à la création d’un compte par identifiant', () => {
    const source = readFileSync(join(RACINE, 'services/utilisateur.ts'), 'utf8');
    const creation = source.slice(
      source.indexOf('export async function creerCompteSansEmail'),
      source.indexOf('export async function reinitialiserMotDePasse'),
    );
    expect(creation).toContain('CLAIM_MOT_DE_PASSE_PROVISOIRE');
  });

  it('est reposé à chaque réinitialisation par le directeur', () => {
    // Un mot de passe redonné par le directeur a transité par un papier lui
    // aussi : l'oublier ici laisserait ce mot de passe-là en place à vie.
    const source = readFileSync(join(RACINE, 'services/utilisateur.ts'), 'utf8');
    const debut = source.indexOf('export async function reinitialiserMotDePasse');
    expect(debut, 'fonction introuvable').toBeGreaterThan(-1);
    const corps = source.slice(debut, source.indexOf('await auditLog', debut));
    expect(corps).toContain('CLAIM_MOT_DE_PASSE_PROVISOIRE');
  });
});

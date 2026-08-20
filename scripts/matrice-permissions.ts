/**
 * Génère `Docs/11-Matrice-permissions.md` à partir des gardes `requireRole`
 * de `src/services/`.
 *
 * Usage :
 *   npx tsx scripts/matrice-permissions.ts            écrit le document
 *   npx tsx scripts/matrice-permissions.ts --verifier   échoue si le document
 *                                                      est périmé (pour la CI)
 *   npx tsx scripts/matrice-permissions.ts --instantane régénère l'instantané
 *                                                      comparé par les tests
 *
 * La logique d'extraction vit dans `src/lib/permissions/matrice.ts` : elle est
 * pure, donc testée par Vitest sans passer par ce script.
 *
 * Attention : `Docs/` est hors du dépôt Git. `--verifier` n'a donc de sens
 * qu'en local, sur une copie de travail qui possède déjà le document ; en
 * intégration continue, sur un clone neuf, il échouerait sur une absence et non
 * sur une vraie dérive. Le garde-fou qui compte, lui, reste versionné :
 * `src/lib/permissions/__tests__/matrice.instantane.txt`, comparé par
 * `matrice.test.ts` à chaque `npm run test`.
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  extraireMatrice,
  signature,
  versMarkdown,
  type FichierService,
} from '../src/lib/permissions/matrice';

const RACINE = join(__dirname, '..');
const SERVICES = join(RACINE, 'src', 'services');
const SORTIE = join(RACINE, 'Docs', '11-Matrice-permissions.md');
const INSTANTANE = join(
  RACINE, 'src', 'lib', 'permissions', '__tests__', 'matrice.instantane.txt',
);

export function lireServices(): FichierService[] {
  return readdirSync(SERVICES)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => ({
      nom: f.replace(/\.ts$/, ''),
      contenu: readFileSync(join(SERVICES, f), 'utf8'),
    }));
}

function principal(): void {
  const entrees = extraireMatrice(lireServices());
  const markdown = versMarkdown(entrees);
  const verifier = process.argv.includes('--verifier');

  // `--instantane` regenere le fichier compare par matrice.test.ts. Geste
  // volontaire : un changement de garde doit se relire en diff, jamais se
  // rattraper tout seul.
  if (process.argv.includes('--instantane')) {
    writeFileSync(INSTANTANE, entrees.map(signature).join('\n') + '\n', 'utf8');
    console.log(`Instantane regenere : ${entrees.length} gardes.`);
    return;
  }

  if (verifier) {
    // Comparaison insensible aux fins de ligne : Git normalise en CRLF sur
    // Windows à la sortie, alors que ce script écrit en LF. Sans cela, la
    // vérification échouerait sur tout dépôt fraîchement cloné, pour une
    // difference qui n'en est pas une.
    const sansCr = (texte: string) => texte.replace(/\r/g, '');
    const actuel = existsSync(SORTIE) ? readFileSync(SORTIE, 'utf8') : '';
    if (sansCr(actuel) !== sansCr(markdown)) {
      console.error(
        'Docs/11-Matrice-permissions.md est perime. Relancer sans --verifier pour le regenerer.',
      );
      process.exit(1);
    }
    console.log(`Matrice a jour : ${entrees.length} fonctions.`);
    return;
  }

  writeFileSync(SORTIE, markdown, 'utf8');
  const parGarde = new Map<string, number>();
  for (const e of entrees) parGarde.set(e.garde.type, (parGarde.get(e.garde.type) ?? 0) + 1);
  console.log(`Ecrit ${SORTIE}`);
  console.log(`${entrees.length} fonctions exportees :`);
  for (const [type, n] of [...parGarde].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}  ${type}`);
  }
}

principal();

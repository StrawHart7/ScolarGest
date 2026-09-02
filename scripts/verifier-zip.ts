/**
 * Oracle extérieur pour `src/lib/zip.ts`.
 *
 * Les tests unitaires vérifient l'archive contre la spécification, avec notre
 * propre lecture. Ça ne prouve pas qu'un outil tiers l'ouvre. Ce script écrit
 * une archive puis la fait extraire par l'Explorateur Windows
 * (`Expand-Archive`), et compare les fichiers obtenus aux originaux.
 *
 *   npx tsx scripts/verifier-zip.ts
 */
import { writeFileSync, readFileSync, rmSync, mkdirSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { construireZip } from '../src/lib/zip';

const CAS = [
  { nom: 'KOFFI Yao - BUL-2026-0001.pdf', contenu: '%PDF-1.4 premier bulletin' },
  { nom: 'ADJÉ Éléonore - BUL-2026-0002.pdf', contenu: 'accents dans le nom' },
  { nom: 'KOFFI/AGBO Kodjo - BUL-2026-0003.pdf', contenu: 'barre oblique a neutraliser' },
];

function main() {
  const base = join(tmpdir(), `verif-zip-${Date.now()}`);
  const extraction = join(base, 'sortie');
  mkdirSync(extraction, { recursive: true });
  const archive = join(base, 'bulletins.zip');

  const encodeur = new TextEncoder();
  const zip = construireZip(
    CAS.map((c) => ({ nom: c.nom, contenu: encodeur.encode(c.contenu) })),
  );
  writeFileSync(archive, zip);

  // Expand-Archive n'est pas notre code : c'est là tout l'intérêt.
  execFileSync(
    'powershell.exe',
    ['-NoProfile', '-Command', `Expand-Archive -Path '${archive}' -DestinationPath '${extraction}' -Force`],
    { stdio: 'pipe' },
  );

  const obtenus = readdirSync(extraction).sort();
  console.log(`Archive de ${zip.length} octets, ${CAS.length} fichiers.`);
  console.log(`Extraits par Expand-Archive : ${obtenus.length}`);

  let echecs = 0;
  for (const cas of CAS) {
    const attendu = cas.nom.replace(/[/\\:*?"<>|]/g, '-');
    const chemin = join(extraction, attendu);
    try {
      const lu = readFileSync(chemin, 'utf8');
      const ok = lu === cas.contenu;
      console.log(`${ok ? 'OK  ' : 'ECHEC'} ${attendu}`);
      if (!ok) echecs += 1;
    } catch {
      console.log(`ECHEC ${attendu} — absent de l'extraction`);
      echecs += 1;
    }
  }

  rmSync(base, { recursive: true, force: true });
  if (echecs > 0) {
    console.error(`${echecs} fichier(s) incorrect(s).`);
    process.exit(1);
  }
  console.log('Archive lue et vérifiée par un outil tiers.');
}

main();

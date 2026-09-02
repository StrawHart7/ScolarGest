/**
 * Aperçu local du gabarit de bulletin secondaire — aucune base, aucune session.
 *
 * Le gabarit est une fonction pure de ses entrées : on peut donc le regarder
 * sans passer par l'application. C'est ce qui permet de vérifier la mise en
 * page (hauteurs de ligne égales, pied collé en bas, une seule page) avant de
 * déployer, plutôt que de la raisonner.
 *
 *   npx tsx scripts/apercu-bulletin.ts [nombreDeMatieres]
 */
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { renderBulletinSecondaireHtml } from '../src/lib/pdf/templates/bulletin-secondaire';
import type { BulletinTemplateInput } from '../src/lib/pdf/templates/bulletin';

const NOMS = [
  'Français',
  'Mathématiques',
  'Histoire-Géographie',
  'Anglais',
  'Physique-Chimie',
  'Sciences de la Vie et de la Terre',
  'Éducation civique et morale',
  'Éducation physique et sportive',
  'Allemand',
  'Espagnol',
  'Philosophie',
  'Ewe',
  'Musique',
  'Dessin',
  'Informatique',
];

const nombre = Number(process.argv[2] ?? 10);

const matieres = NOMS.slice(0, nombre).map((matiereNom, i) => {
  // Une matière sur cinq reste sans note, comme sur le modèle papier.
  const notee = i % 5 !== 4;
  const moyenne = notee ? Math.round((8 + ((i * 37) % 110) / 10) * 100) / 100 : null;
  return {
    matiereId: String(i),
    matiereNom,
    obligatoire: true,
    coefficient: [4, 4, 3, 3, 3, 2, 2, 1, 1, 1, 2, 1, 1, 1, 1][i] ?? 1,
    moyInterros: moyenne,
    devoir: moyenne,
    moyClasse: moyenne,
    composition: moyenne,
    moyenneFinale: moyenne,
    rangMatiere: notee ? ((i * 3) % 20) + 1 : null,
    // Un nom long, exprès : c'est lui qui faisait grossir la ligne.
    professeurs: i % 3 === 0 ? 'Jean-Baptiste Kokou ADJOVI-BOCO' : 'M. AGBOKA',
  };
});

const input: BulletinTemplateInput & { eleve: { sexe?: 'M' | 'F' } } = {
  etablissement: {
    nom: 'Complexe Scolaire Les Victorieux',
    adresse: null,
    ville: 'Lomé',
    telephone: '90 00 00 00',
    email: null,
  },
  anneeScolaireLibelle: '2025-2026',
  periodeLabel: '1er Trimestre',
  eleve: {
    nom: 'KOFFI',
    prenoms: 'Yao Emmanuel',
    dateNaissance: '2010-04-12',
    matricule: 'ELV-0001',
    sexe: 'M',
  },
  classeNom: '3ème A',
  reference: 'BUL-2026-0001',
  dateGeneration: '2026-09-02',
  donnees: {
    eleveId: 'e1',
    classeId: 'c1',
    periode: 'TRIMESTRE_1' as never,
    anneeScolaireId: 'a1',
    matieres,
    synthese: {
      moyenneTrimestrielle: 14.27,
      appreciation: 'Bien',
      rangGeneral: 3,
      effectifClasse: 20,
      meilleureMoyenneClasse: 15.09,
      plusFaibleMoyenneClasse: 8.3,
      moyenneGeneraleClasse: 11.93,
      moyenneAnnuelle: 14.42,
    },
  },
};

async function main() {
  const html = renderBulletinSecondaireHtml(input);
  const sortie = `apercu-bulletin-${nombre}`;
  writeFileSync(`${sortie}.html`, html, 'utf8');

  const navigateur = await chromium.launch();
  const page = await navigateur.newPage();
  await page.setContent(html, { waitUntil: 'load' });
  await page.pdf({ path: `${sortie}.pdf`, format: 'A4', printBackground: true });
  await page.setViewportSize({ width: 794, height: 1123 });
  await page.screenshot({ path: `${sortie}.png`, fullPage: true });
  const hauteur = await page.evaluate(() => document.body.scrollHeight);
  await navigateur.close();

  console.log(`${nombre} matières -> ${sortie}.pdf / .png — hauteur corps ${hauteur}px (page A4 ≈ 1123px)`);
}

main();

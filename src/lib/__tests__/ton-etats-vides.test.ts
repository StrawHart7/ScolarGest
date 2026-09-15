import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Une couleur d'alarme ne dit pas un état subi.
 *
 * `text-error` désigne une **faute** : une saisie refusée, une contrainte
 * violée, une action qui a échoué. Une école qui n'a pas encore d'année
 * scolaire, pas encore de tarif, pas encore d'élève n'a rien cassé — c'est
 * l'état normal d'une école de trois jours. Le rouge y inquiète sans rien
 * proposer.
 *
 * La règle était déjà écrite dans `CLAUDE.md` pour la bannière hors-ligne, et
 * elle n'avait jamais été appliquée ailleurs. Au 2026-09-15, quatre écrans la
 * violaient : l'inscription d'un élève, le passage de cohorte et les deux
 * écrans d'import, tous pour dire « activez une année scolaire ».
 *
 * ## Ce que le test attrape
 *
 * Une ligne qui porte à la fois `text-error` et le vocabulaire d'un état vide
 * ou d'un prérequis manquant. C'est volontairement étroit : il ne juge pas le
 * ton d'un message d'erreur réel, il attrape la confusion entre « vous avez
 * échoué » et « ce n'est pas encore configuré ».
 *
 * Le motif a été réintroduit pour vérifier qu'il tombe — sans quoi ce fichier
 * serait un test qui rassure à tort, et ce dépôt en a déjà payé un.
 */

const RACINE = join(process.cwd(), 'src', 'app');

/** Le vocabulaire d'un état qu'on n'a pas provoqué. */
const ETAT_SUBI =
  /Aucun|Activez|Créez|Commencez par|avant de |avant d’|avant d'|n’est pas encore|n'est pas encore|pas encore de /i;

function fichiersEcrans(dossier: string): string[] {
  const trouves: string[] = [];
  for (const entree of readdirSync(dossier)) {
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) {
      if (entree === '__tests__') continue;
      trouves.push(...fichiersEcrans(chemin));
    } else if (entree.endsWith('.tsx')) {
      trouves.push(chemin);
    }
  }
  return trouves;
}

/**
 * Distance, en caractères, entre `text-error` et le texte qu'il colore.
 *
 * La première version travaillait **ligne à ligne**, et laissait donc passer le
 * cas le plus courant : le formateur met `className` sur une ligne et le texte
 * sur la suivante. Elle est restée verte devant un `text-error` de
 * `/demarrage` — l'écran qu'un directeur voit en tout premier. Vérifié en
 * l'exécutant, pas supposé.
 */
const PORTEE = 220;

/** Les passages fautifs d'un fichier. Isolée pour pouvoir éprouver le test lui-même. */
export function lignesFautives(contenu: string): string[] {
  const plat = contenu.replace(/\s+/g, ' ');
  const trouves: string[] = [];
  let depuis = 0;
  for (;;) {
    const i = plat.indexOf('text-error', depuis);
    if (i < 0) break;
    depuis = i + 1;
    const fenetre = plat.slice(i, i + PORTEE);
    // On s'arrête à la balise fermante : au-delà, le texte appartient à un
    // autre élément et n'est pas colore par ce `text-error`.
    const contenuBalise = fenetre.split('</p>')[0] ?? fenetre;
    if (ETAT_SUBI.test(contenuBalise)) trouves.push(contenuBalise.trim());
  }
  return trouves;
}

describe('le ton des états vides', () => {
  it('attrape le motif qu’on vient de retirer', () => {
    // Les quatre cas réels du 2026-09-15, et deux messages d'erreur légitimes
    // qui ne doivent pas être signalés.
    expect(
      lignesFautives('<p className="text-body-sm text-error">Aucune année scolaire active.</p>'),
    ).toHaveLength(1);
    expect(
      lignesFautives('<p className="text-error">Activez une année scolaire avant d’importer.</p>'),
    ).toHaveLength(1);

    // Le cas qui passait à travers la première version : `className` et texte
    // sur deux lignes.
    expect(
      lignesFautives('<p className="mt-3 text-body-sm text-error">\n  Aucune classe n’existe.\n</p>'),
    ).toHaveLength(1);

    expect(lignesFautives('<p className="text-error">{erreur}</p>')).toHaveLength(0);
    expect(
      lignesFautives('<p className="text-error">Le montant dépasse le solde restant.</p>'),
    ).toHaveLength(0);
    expect(
      lignesFautives('<p className="text-body-sm text-text-secondary">Aucun tarif fixé.</p>'),
    ).toHaveLength(0);
  });

  it('n’emploie plus le rouge pour dire qu’une chose n’existe pas encore', () => {
    const fautives: string[] = [];
    for (const fichier of fichiersEcrans(RACINE)) {
      for (const ligne of lignesFautives(readFileSync(fichier, 'utf8'))) {
        fautives.push(`${fichier.replace(process.cwd(), '')} : ${ligne}`);
      }
    }

    expect(
      fautives,
      'ces écrans annoncent en rouge un état que l’utilisateur n’a pas provoqué',
    ).toEqual([]);
  });
});

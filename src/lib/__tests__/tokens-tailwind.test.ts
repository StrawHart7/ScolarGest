import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import config from '../../../tailwind.config';

/**
 * Une classe de couleur qui ne correspond à aucun token ne casse rien : elle
 * n'est simplement **jamais générée**.
 *
 * Le bloc s'affiche alors sans fond, en texte noir sur blanc, exactement là où
 * il devait se distinguer de la page. Ni le build, ni `tsc`, ni ESLint ne le
 * voient — c'est une chaîne de caractères qui n'existe nulle part.
 *
 * Trois fois en deux semaines :
 *
 * - `bg-warning-container` — l'indicateur de file hors ligne et le formulaire
 *   de versement, corrigés le 2026-09-05 en **ajoutant** le token manquant ;
 * - `bg-success-container` — le message « encaissement enregistré », trouvé le
 *   2026-09-14 et corrigé le lendemain ;
 * - `bg-surface-subtle` et `text-success`, que j'ai failli écrire moi-même le
 *   2026-09-14 en composant le panneau de verrou, attrapés à la relecture.
 *
 * Documenter le piège n'a pas suffi : la config porte déjà un commentaire de
 * six lignes racontant le premier. Ce test le rend impossible à refaire.
 *
 * ## Deux règles, et pourquoi la première ne suffisait pas
 *
 * **Règle 1 — racine connue, suffixe inconnu.** `bg-primary-foo` : `primary`
 * est à nous, `primary.foo` n'existe pas. Elle attrape les fautes de frappe
 * dans une famille existante.
 *
 * Écrite seule, elle laissait passer exactement le défaut qu'on répare. Vérifié
 * en réintroduisant `bg-success-container` : le test restait vert, parce que
 * `success` n'est déclaré nulle part — donc pas une de nos racines — et qu'une
 * racine inconnue est traitée comme la palette native de Tailwind (`bg-red-500`,
 * `text-white`). **La famille entière était le point aveugle.**
 *
 * **Règle 2 — suffixe inconnu terminé par un de nos sous-tokens.** `container`,
 * `on-container`, `variant`, `lowest`… sont notre vocabulaire, pas celui de
 * Tailwind. Une classe qui se termine par l'un d'eux et qui n'est pas déclarée
 * ne peut être qu'une invention. `bg-success-container` tombe ici.
 *
 * Cette seconde règle ne se déclenche pas sur `text-center`, `bg-cover` ni
 * `bg-red-500` : `center`, `cover` et `500` ne sont pas des sous-tokens. C'est
 * ce qui la rend sûre sans avoir à énumérer les utilitaires de Tailwind.
 *
 * Les classes construites dynamiquement (`bg-${ton}-container`) échappent aux
 * deux, par construction. Ce n'est pas une raison de ne pas attraper le reste.
 */

const RACINE = join(process.cwd(), 'src');

/** Aplatit `theme.extend.colors` en suffixes de classe : `surface-container-lowest`, `warning`, … */
function suffixesDeclares(): Set<string> {
  const suffixes = new Set<string>();
  const parcourir = (valeur: unknown, prefixe: string[]) => {
    if (typeof valeur === 'string') {
      // `DEFAULT` n'apparaît pas dans la classe : `primary.DEFAULT` est
      // `bg-primary`, pas `bg-primary-default`.
      const chemin = prefixe.filter((p) => p !== 'DEFAULT');
      if (chemin.length > 0) suffixes.add(chemin.join('-'));
      return;
    }
    if (valeur && typeof valeur === 'object') {
      for (const [cle, sous] of Object.entries(valeur)) parcourir(sous, [...prefixe, cle]);
    }
  };
  parcourir(config.theme?.extend?.colors ?? {}, []);
  return suffixes;
}

/** Les tailles de police déclarées : `text-body-sm` n'est pas une couleur. */
function taillesDeclarees(): Set<string> {
  return new Set(Object.keys(config.theme?.extend?.fontSize ?? {}));
}

function fichiersSources(dossier: string): string[] {
  const trouves: string[] = [];
  for (const entree of readdirSync(dossier)) {
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) {
      // Les tests ne rendent rien : une classe citée dans un commentaire ou une
      // assertion n'a aucun effet à l'écran. Ce fichier-ci en nomme trois en
      // exemple, et se signalait lui-même au premier essai.
      if (entree === '__tests__') continue;
      trouves.push(...fichiersSources(chemin));
    } else if (/\.tsx?$/.test(entree)) {
      trouves.push(chemin);
    }
  }
  return trouves;
}

const PREFIXES = 'bg|text|border|ring|fill|stroke|divide|outline|decoration|from|via|to';
const CLASSE = new RegExp(`\\b(${PREFIXES})-([a-z][a-z0-9-]*)`, 'g');

/**
 * `border-l-primary-container` est une bordure gauche colorée, parfaitement
 * valide. Sans ce retrait, `l-primary-container` n'est déclaré nulle part et
 * `toast.tsx` était signalé à tort — deux fois.
 */
const COTES = /^(l|r|t|b|x|y|s|e)-/;

/**
 * `ring-offset-surface-container-lowest` colore l'anneau de décalage, et
 * `ring-offset-background` aussi. Trois écrans les emploient ; sans ce retrait
 * ils étaient signalés à tort.
 */
const DECALAGE = /^offset-/;

/**
 * Les commentaires ne sont pas rendus.
 *
 * Le correctif de `NouveauVersementForm.tsx` **nomme** `bg-success-container`
 * pour expliquer ce qui n'allait pas, et le test se signalait donc lui-même sur
 * le fichier qu'il venait de réparer. Une classe citée dans une explication
 * n'atteint aucun écran.
 */
function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

describe('les classes de couleur employées existent dans tailwind.config.ts', () => {
  const suffixes = suffixesDeclares();
  const tailles = taillesDeclarees();
  const racines = new Set([...suffixes].map((s) => s.split('-')[0]));
  /** Notre vocabulaire de sous-tokens : `container`, `on-container`, `variant`… */
  const sousTokens = new Set(
    [...suffixes].flatMap((s) => {
      const segments = s.split('-');
      return segments.length > 1 ? [segments[segments.length - 1] as string] : [];
    }),
  );

  /** La faute, s'il y en a une, sinon `null`. Exportée par la boucle et par le test du test. */
  function fautive(prefixe: string, suffixeBrut: string): boolean {
    const suffixe =
      prefixe === 'border'
        ? suffixeBrut.replace(COTES, '')
        : prefixe === 'ring'
          ? suffixeBrut.replace(DECALAGE, '')
          : suffixeBrut;
    if (suffixes.has(suffixe)) return false;
    // `text-` sert aussi aux tailles de police.
    if (prefixe === 'text' && tailles.has(suffixe)) return false;

    const premier = suffixe.split('-')[0] ?? '';
    const dernier = suffixe.split('-').slice(-1)[0] ?? '';
    // Règle 1 : racine à nous, suffixe inconnu.
    if (racines.has(premier)) return true;
    // Règle 2 : se termine par un de nos sous-tokens sans être déclaré.
    return suffixe.includes('-') && sousTokens.has(dernier);
  }

  it('déclare bien des tokens et des tailles à confronter', () => {
    // Garde-fou du test : si la lecture de la config cassait, tout passerait
    // sur des ensembles vides sans rien vérifier.
    expect(suffixes.size).toBeGreaterThan(10);
    expect(tailles.size).toBeGreaterThan(5);
    expect(suffixes.has('warning-container')).toBe(true);
    expect(sousTokens.has('container')).toBe(true);
  });

  it('attrape les trois fautes réellement commises, et épargne Tailwind', () => {
    // Le test du test. Sans lui, la première version restait verte devant
    // `bg-success-container` et rassurait à tort — constaté, pas supposé.
    expect(fautive('bg', 'success-container')).toBe(true);
    expect(fautive('bg', 'surface-subtle')).toBe(true);
    expect(fautive('text', 'success')).toBe(false); // racine inconnue, sans sous-token : hors portée
    expect(fautive('bg', 'primary-foo')).toBe(true);

    expect(fautive('bg', 'warning-container')).toBe(false);
    expect(fautive('text', 'text-primary')).toBe(false);
    expect(fautive('bg', 'surface-container-lowest')).toBe(false);
    expect(fautive('text', 'body-sm')).toBe(false);
    expect(fautive('text', 'center')).toBe(false);
    expect(fautive('bg', 'red-500')).toBe(false);
    expect(fautive('bg', 'white')).toBe(false);
    expect(fautive('border', 'transparent')).toBe(false);
    // Bordure directionnelle colorée : `toast.tsx` en emploie deux.
    expect(fautive('border', 'l-primary-container')).toBe(false);
    expect(fautive('border', 'l-success-container')).toBe(true);
    // Anneau de décalage : trois écrans en emploient.
    expect(fautive('ring', 'offset-surface-container-lowest')).toBe(false);
    expect(fautive('ring', 'offset-success-container')).toBe(true);
  });

  it('ne lit pas les classes citées dans un commentaire', () => {
    // Le correctif de `NouveauVersementForm.tsx` nomme la classe fautive pour
    // expliquer ce qui n'allait pas. Le test se signalait sur le fichier qu'il
    // venait de réparer.
    expect(sansCommentaires('// bg-success-container\nconst a = 1;')).not.toContain('bg-success');
    expect(sansCommentaires('/* bg-success-container */')).not.toContain('bg-success');
    // Une URL n'est pas un commentaire.
    expect(sansCommentaires('const u = "https://x.tg";')).toContain('https://x.tg');
  });

  it('n’emploie aucune classe de couleur inexistante', () => {
    const fautives: string[] = [];

    for (const fichier of fichiersSources(RACINE)) {
      const contenu = sansCommentaires(readFileSync(fichier, 'utf8'));
      for (const [, prefixe, suffixe] of contenu.matchAll(CLASSE)) {
        if (!prefixe || !suffixe) continue;
        if (fautive(prefixe, suffixe)) {
          fautives.push(`${fichier.replace(process.cwd(), '')} : ${prefixe}-${suffixe}`);
        }
      }
    }

    expect(
      [...new Set(fautives)],
      'ces classes ne seront générées par personne et s’afficheront sans effet',
    ).toEqual([]);
  });
});

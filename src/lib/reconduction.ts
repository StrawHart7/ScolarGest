/**
 * Reprendre d'une année sur l'autre ce qui ne change presque jamais.
 *
 * ## Le problème
 *
 * Dix tables portent `anneeScolaireId`. Cinq d'entre elles décrivent la même
 * chose d'une année à l'autre : les tarifs, les affectations d'enseignants, les
 * professeurs principaux, l'emploi du temps. Une école de quatorze classes
 * repart donc chaque rentrée de quatre-vingt-treize tarifs, cent treize
 * affectations et treize titularités à ressaisir une par une.
 *
 * Ce module ne fait pas la reprise : il calcule **ce qu'on proposerait**. Les
 * écritures vivent dans `src/services/reconduction.ts`, avec leurs gardes.
 * Sans dépendance, donc testable et importable d'un composant client.
 *
 * ## Deux mécanismes, et c'est délibéré
 *
 * Les tarifs se rapprochent **par niveau**, pas par classe. Mesuré sur les
 * données réelles le 2026-09-17 : chez une école de quatorze classes, chaque
 * niveau qui en compte plusieurs porte **un seul montant** par type de frais —
 * la 6ème A et la 6ème B sont à 65 000 toutes les deux, sur les sept frais.
 * Le tarif est stocké par classe (décision Q7) mais se décide par niveau, et le
 * rapprocher par niveau évite entièrement la question de l'identité des classes.
 *
 * Tout le reste se rapproche **par classe**, parce que l'identité compte : un
 * professeur enseigne en 6ème A, pas « en sixième ». D'où `apparierClasses`.
 */

export interface ClasseAApparier {
  id: string;
  nom: string;
  niveauId: string;
  serieId: string | null;
}

/** Ce qui a permis de rapprocher deux classes — une déduction n'a pas la même valeur qu'une égalité. */
export type MotifAppariement = 'NOM' | 'SEULE_CANDIDATE';

export interface PaireClasses {
  source: ClasseAApparier;
  cible: ClasseAApparier;
  motif: MotifAppariement;
}

export interface Appariement {
  paires: PaireClasses[];
  /** Classes de l'année cible sans équivalent : à faire à la main, et dit comme tel. */
  orphelines: ClasseAApparier[];
}

/** Niveau + série : ce qui définit « la même classe, un an plus tard ». */
function cle(c: { niveauId: string; serieId: string | null }): string {
  return `${c.niveauId}|${c.serieId ?? ''}`;
}

/** « 6ème A », « 6eme  a » et « 6ÈME A » désignent la même classe. */
function normaliser(nom: string): string {
  return nom
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Rapproche les classes de l'année cible de celles de l'année source.
 *
 * Deux passes, dans cet ordre :
 *
 * 1. **Même niveau, même série, même nom.** C'est le cas courant — une école
 *    garde ses intitulés d'une année sur l'autre.
 * 2. **Seule candidate restante** de part et d'autre pour ce niveau et cette
 *    série. Couvre le renommage : « 6ème A » devenue « 6ème 1 ».
 *
 * **Ce qui reste n'est pas deviné.** Trois classes renommées face à trois
 * classes sans correspondance de nom produisent trois orphelines, pas trois
 * paires au hasard. Rapprocher à tort attribuerait l'emploi du temps d'une
 * classe à une autre, et l'erreur ne se verrait qu'à la première heure de
 * cours — un mauvais rapprochement coûte plus cher qu'une saisie à la main.
 */
export function apparierClasses(
  source: ClasseAApparier[],
  cible: ClasseAApparier[],
): Appariement {
  const parCleSource = new Map<string, ClasseAApparier[]>();
  for (const c of source) {
    const groupe = parCleSource.get(cle(c)) ?? [];
    groupe.push(c);
    parCleSource.set(cle(c), groupe);
  }

  const paires: PaireClasses[] = [];
  const orphelines: ClasseAApparier[] = [];
  const prises = new Set<string>();

  // Passe 1 — égalité de nom.
  const restantes: ClasseAApparier[] = [];
  for (const c of cible) {
    const candidates = parCleSource.get(cle(c)) ?? [];
    const exacte = candidates.find(
      (s) => !prises.has(s.id) && normaliser(s.nom) === normaliser(c.nom),
    );
    if (exacte) {
      prises.add(exacte.id);
      paires.push({ source: exacte, cible: c, motif: 'NOM' });
    } else {
      restantes.push(c);
    }
  }

  // Passe 2 — une seule candidate de chaque côté pour ce niveau et cette série.
  const restantesParCle = new Map<string, ClasseAApparier[]>();
  for (const c of restantes) {
    const groupe = restantesParCle.get(cle(c)) ?? [];
    groupe.push(c);
    restantesParCle.set(cle(c), groupe);
  }

  for (const [k, groupeCible] of restantesParCle) {
    const libres = (parCleSource.get(k) ?? []).filter((s) => !prises.has(s.id));
    if (groupeCible.length === 1 && libres.length === 1) {
      const seuleCible = groupeCible[0]!;
      const seuleSource = libres[0]!;
      prises.add(seuleSource.id);
      paires.push({ source: seuleSource, cible: seuleCible, motif: 'SEULE_CANDIDATE' });
    } else {
      orphelines.push(...groupeCible);
    }
  }

  return { paires, orphelines };
}

export interface TarifSource {
  niveauId: string;
  serieId: string | null;
  typeFraisId: string;
  typeFraisNom: string;
  montant: number;
}

export interface PropositionTarif {
  classeCibleId: string;
  classeCibleNom: string;
  typeFraisId: string;
  typeFraisNom: string;
  montant: number;
}

export interface ConflitTarif {
  niveauId: string;
  serieId: string | null;
  typeFraisNom: string;
  montants: number[];
}

/**
 * Montants à proposer pour l'année cible, déduits du niveau.
 *
 * Rien n'est écrit : ce sont des **valeurs de formulaire**. Un tarif est
 * immuable après création (doc 08 § 6) — le poser d'office enfermerait l'école
 * dans les prix de l'an dernier pour toute l'année, alors qu'une rentrée est
 * précisément le moment où les prix bougent. Le Directeur voit les montants
 * remplis, corrige ceux qui ont changé, et valide une fois.
 *
 * **Un niveau qui portait deux montants différents pour le même frais ne
 * produit aucune proposition**, seulement un conflit nommé. Choisir à sa place
 * poserait un prix que personne n'a décidé, et un prix faux est pire qu'un
 * champ vide : le champ vide se voit.
 */
export function propositionsTarifs(
  tarifsSource: TarifSource[],
  classesCible: ClasseAApparier[],
): { propositions: PropositionTarif[]; conflits: ConflitTarif[] } {
  const parCleEtFrais = new Map<string, TarifSource[]>();
  for (const t of tarifsSource) {
    const k = `${cle(t)}|${t.typeFraisId}`;
    const groupe = parCleEtFrais.get(k) ?? [];
    groupe.push(t);
    parCleEtFrais.set(k, groupe);
  }

  const propositions: PropositionTarif[] = [];
  const conflits: ConflitTarif[] = [];
  const conflitsVus = new Set<string>();

  for (const classe of classesCible) {
    for (const [k, groupe] of parCleEtFrais) {
      if (!k.startsWith(`${cle(classe)}|`)) continue;
      const premier = groupe[0]!;
      const montants = [...new Set(groupe.map((t) => Number(t.montant)))];

      if (montants.length > 1) {
        if (!conflitsVus.has(k)) {
          conflitsVus.add(k);
          conflits.push({
            niveauId: premier.niveauId,
            serieId: premier.serieId,
            typeFraisNom: premier.typeFraisNom,
            montants: montants.sort((a, b) => a - b),
          });
        }
        continue;
      }

      propositions.push({
        classeCibleId: classe.id,
        classeCibleNom: classe.nom,
        typeFraisId: premier.typeFraisId,
        typeFraisNom: premier.typeFraisNom,
        montant: montants[0]!,
      });
    }
  }

  return { propositions, conflits };
}

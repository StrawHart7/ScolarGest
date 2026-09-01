/**
 * Agregation statistique. **Aucune dependance, aucune requete** — que du calcul.
 *
 * Isole du service pour etre testable sans base : c'est ici que vivent les
 * regles qui peuvent mentir si on les ecrit mal.
 */

/**
 * Seuil de reussite, sur 20.
 *
 * Pas une invention : le bareme d'appreciation du projet
 * (`calcul-moyennes.appreciation`) bascule d'« Insuffisant » a « Passable » a
 * 10. Reprendre ce seuil evite qu'une page annonce un taux de reussite qui
 * contredise l'appreciation imprimee sur le bulletin du meme eleve.
 */
export const SEUIL_REUSSITE = 10;

/**
 * Tranches de la distribution, nommees par le bareme d'appreciation existant.
 *
 * Reprendre le vocabulaire des bulletins plutot qu'inventer des paliers : le
 * Directeur lit « Assez Bien » toute l'annee, lui montrer « 12-14 » l'obligerait
 * a traduire.
 */
export const TRANCHES: { libelle: string; min: number; max: number }[] = [
  { libelle: 'Très insuffisant et moins', min: 0, max: 8 },
  { libelle: 'Insuffisant', min: 8, max: 10 },
  { libelle: 'Passable', min: 10, max: 12 },
  { libelle: 'Assez bien', min: 12, max: 14 },
  { libelle: 'Bien', min: 14, max: 16 },
  { libelle: 'Très bien et plus', min: 16, max: 20.0001 },
];

export interface MoyenneMatiere {
  matiereId: string;
  matiereNom: string;
  moyenne: number | null;
}

export interface EleveEvalue {
  eleveId: string;
  classeId: string;
  classeNom: string;
  niveauNom: string;
  sexe: 'F' | 'M';
  /** `null` quand l'eleve n'a aucune note sur la periode. */
  moyenne: number | null;
  matieres: MoyenneMatiere[];
}

export interface StatGroupe {
  id: string;
  libelle: string;
  /** Eleves ayant une moyenne sur la periode. */
  effectif: number;
  moyenne: number | null;
  /** Part d'eleves au-dessus du seuil, en %. `null` si personne n'est evalue. */
  tauxReussite: number | null;
}

export interface StatMatiere extends StatGroupe {
  /** Ecart a la moyenne generale, en points. Positif = matiere plus reussie. */
  ecart: number | null;
}

export interface StatistiquesAcademiques {
  effectifEvalue: number;
  effectifTotal: number;
  moyenneGenerale: number | null;
  tauxReussite: number | null;
  classes: StatGroupe[];
  matieres: StatMatiere[];
  parSexe: StatGroupe[];
  distribution: { libelle: string; effectif: number }[];
}

function arrondi(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Moyenne d'une liste, `null` si vide — jamais 0, qui serait une note. */
function moyenne(valeurs: number[]): number | null {
  if (valeurs.length === 0) return null;
  return arrondi(valeurs.reduce((s, v) => s + v, 0) / valeurs.length);
}

function taux(valeurs: number[]): number | null {
  if (valeurs.length === 0) return null;
  return Math.round((valeurs.filter((v) => v >= SEUIL_REUSSITE).length / valeurs.length) * 100);
}

/**
 * Agrege les eleves evalues en indicateurs par classe, matiere et sexe.
 *
 * **Un eleve sans moyenne n'entre dans aucun calcul.** Le compter comme zero
 * ferait plonger la moyenne d'une classe dont les notes ne sont pas encore
 * saisies, et donnerait l'alerte exactement au mauvais moment — en debut de
 * trimestre, quand il n'y a rien a alerter. `effectifEvalue` et
 * `effectifTotal` sont donc distincts, et l'ecran doit montrer les deux.
 *
 * `classesConnues` sert a faire figurer les classes **sans aucun eleve
 * evalue** : leur absence de la liste se lirait comme une omission, alors
 * qu'elle est une information — personne n'y a encore saisi de notes.
 */
export function agregerStatistiques(
  eleves: EleveEvalue[],
  classesConnues: { id: string; nom: string; niveauNom: string }[],
): StatistiquesAcademiques {
  const avecMoyenne = eleves.filter(
    (e): e is EleveEvalue & { moyenne: number } => e.moyenne !== null,
  );
  const toutes = avecMoyenne.map((e) => e.moyenne);
  const moyenneGenerale = moyenne(toutes);

  // --- Par classe
  const parClasse = new Map<string, number[]>();
  for (const e of avecMoyenne) {
    const l = parClasse.get(e.classeId) ?? [];
    l.push(e.moyenne);
    parClasse.set(e.classeId, l);
  }
  const classes: StatGroupe[] = classesConnues.map((c) => {
    const valeurs = parClasse.get(c.id) ?? [];
    return {
      id: c.id,
      libelle: c.nom,
      effectif: valeurs.length,
      moyenne: moyenne(valeurs),
      tauxReussite: taux(valeurs),
    };
  });

  // --- Par matiere, tous niveaux confondus.
  const parMatiere = new Map<string, { nom: string; valeurs: number[] }>();
  for (const e of avecMoyenne) {
    for (const m of e.matieres) {
      if (m.moyenne === null) continue;
      const entree = parMatiere.get(m.matiereId) ?? { nom: m.matiereNom, valeurs: [] };
      entree.valeurs.push(m.moyenne);
      parMatiere.set(m.matiereId, entree);
    }
  }
  const matieres: StatMatiere[] = [...parMatiere.entries()]
    .map(([id, { nom, valeurs }]) => {
      const moy = moyenne(valeurs);
      return {
        id,
        libelle: nom,
        effectif: valeurs.length,
        moyenne: moy,
        tauxReussite: taux(valeurs),
        // L'ecart situe la matiere par rapport au reste, ce que la moyenne
        // brute ne dit pas : 9,5 est faible dans un etablissement a 13, banal
        // dans un etablissement a 9.
        ecart: moy !== null && moyenneGenerale !== null ? arrondi(moy - moyenneGenerale) : null,
      };
    })
    .sort((a, b) => (a.moyenne ?? 99) - (b.moyenne ?? 99));

  // --- Par sexe
  const parSexe: StatGroupe[] = (['F', 'M'] as const).map((sexe) => {
    const valeurs = avecMoyenne.filter((e) => e.sexe === sexe).map((e) => e.moyenne);
    return {
      id: sexe,
      libelle: sexe === 'F' ? 'Filles' : 'Garçons',
      effectif: valeurs.length,
      moyenne: moyenne(valeurs),
      tauxReussite: taux(valeurs),
    };
  });

  // --- Distribution
  const distribution = TRANCHES.map((t) => ({
    libelle: t.libelle,
    effectif: toutes.filter((v) => v >= t.min && v < t.max).length,
  }));

  return {
    effectifEvalue: avecMoyenne.length,
    effectifTotal: eleves.length,
    moyenneGenerale,
    tauxReussite: taux(toutes),
    classes,
    matieres,
    parSexe,
    distribution,
  };
}

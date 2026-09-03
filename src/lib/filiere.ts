/**
 * Vocabulaire des combinaisons niveau/série réellement enseignées.
 *
 * Module sans dépendance, importable depuis un composant client : les services
 * ouvrent un client Supabase, donc `next/headers`, et les importer depuis un
 * formulaire fait échouer la compilation Next. Le vocabulaire vit ici.
 *
 * **Pourquoi cette notion existe.** Un niveau ne suffit pas à désigner ce qu'on
 * enseigne au lycée. « Seconde » n'est pas un programme : la Seconde A4, la
 * Seconde C et la Seconde D ne suivent ni les mêmes matières ni les mêmes
 * coefficients. L'étape « programme » du démarrage les confondait sous un seul
 * intitulé, ce qui obligeait le Directeur à cocher une liste unique pour trois
 * filières distinctes.
 *
 * **Ce n'est pas une entité de base.** Il n'existe ni `niveau_etablissement` ni
 * `serie_etablissement` : une combinaison est « enseignée » parce qu'une classe
 * existe dessus, et rien d'autre ne matérialise ce périmètre. C'est aussi ce
 * qui la fait réapparaître correctement à la reprise du parcours.
 */

export interface CombinaisonEnseignee {
  /** `niveauId|serieId` — stable, sérialisable, utilisable comme clé React. */
  cle: string;
  niveauId: string;
  niveauNom: string;
  serieId: string | null;
  serieNom: string | null;
  /** « Seconde C », ou « 6ème » quand le niveau n'a pas de filière. */
  libelle: string;
  /** Ordre d'affichage : cursus, puis série par ordre alphabétique. */
  rang: number;
}

/**
 * Clé d'une combinaison. `''` pour l'absence de série, et non `'null'` : cette
 * clé se retrouve dans des enregistrements sérialisés vers le client, où la
 * chaîne « null » finirait par être confondue avec un identifiant.
 */
export function cleCombinaison(niveauId: string, serieId: string | null): string {
  return `${niveauId}|${serieId ?? ''}`;
}

/** « Seconde » + « C » → « Seconde C ». Sans série, le niveau seul. */
export function libelleCombinaison(niveauNom: string, serieNom: string | null): string {
  return serieNom ? `${niveauNom} ${serieNom}` : niveauNom;
}

export interface ClasseOuverte {
  niveauId: string;
  serieId: string | null;
  serieNom: string | null;
}

export interface NiveauOrdonne {
  id: string;
  nom: string;
  ordre: number;
  cycleOrdre: number;
}

/**
 * Combinaisons déduites des classes ouvertes.
 *
 * Une école qui ouvre trois Terminale D n'a qu'une combinaison « Terminale D » :
 * le programme se décide par filière, pas par classe. À l'inverse, un niveau
 * sans aucune classe n'apparaît pas — il n'est pas enseigné.
 */
export function combinaisonsEnseignees(
  classes: ClasseOuverte[],
  niveaux: NiveauOrdonne[],
): CombinaisonEnseignee[] {
  const parNiveau = new Map(niveaux.map((n) => [n.id, n]));
  const vues = new Map<string, CombinaisonEnseignee>();

  for (const classe of classes) {
    const niveau = parNiveau.get(classe.niveauId);
    // Une classe sur un niveau hors catalogue courant (cycle retiré, par
    // exemple) ne doit pas faire disparaître les autres : on l'ignore.
    if (!niveau) continue;

    const cle = cleCombinaison(classe.niveauId, classe.serieId);
    if (vues.has(cle)) continue;

    vues.set(cle, {
      cle,
      niveauId: niveau.id,
      niveauNom: niveau.nom,
      serieId: classe.serieId,
      serieNom: classe.serieNom,
      libelle: libelleCombinaison(niveau.nom, classe.serieNom),
      rang: niveau.cycleOrdre * 100 + niveau.ordre,
    });
  }

  return [...vues.values()].sort(
    (a, b) =>
      a.rang - b.rang ||
      (a.serieNom ?? '').localeCompare(b.serieNom ?? '', 'fr'),
  );
}

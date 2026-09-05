/**
 * Vocabulaire des bulletins edites : quel document fait foi, et comment il
 * s'appelle une fois sur le disque.
 *
 * Module sans dependance, importable depuis un composant client comme depuis
 * un service. Il existe parce que la regle « le bulletin en vigueur d'un
 * eleve » etait ecrite **deux fois** : une premiere dans l'ecran des bulletins
 * prets, une seconde — differemment — dans le telechargement groupe. L'ecran
 * groupait par eleve et gardait le plus recent ; le telechargement ne groupait
 * pas du tout et prenait tout ce qui n'etait pas OBSOLETE. Les deux se
 * contredisaient sur le meme jeu de donnees.
 *
 * Decider deux fois, a deux endroits, finit toujours par afficher un bilan que
 * l'autre contredit.
 */

/** Ce que les deux appelants savent d'un document, et rien de plus. */
export interface DocumentBulletin {
  documentId: string;
  reference: string;
  dateGeneration: string;
  statut: string;
  eleveId: string;
}

export const LIBELLE_PERIODE: Record<string, string> = {
  TRIMESTRE_1: 'Trimestre 1',
  TRIMESTRE_2: 'Trimestre 2',
  TRIMESTRE_3: 'Trimestre 3',
};

export function libellePeriode(periode: string): string {
  return LIBELLE_PERIODE[periode] ?? periode;
}

export interface EtatBulletinEleve {
  /** Le document qui fait foi, ou `null` si l'eleve n'en a pas. */
  courant: DocumentBulletin | null;
  /** Versions remplacees, conservees en stockage. */
  remplacees: number;
}

/**
 * Le bulletin en vigueur de chaque eleve, et le nombre de versions remplacees.
 *
 * **`OBSOLETE` ne suffit pas comme critere.** La generation groupee a longtemps
 * empile des documents tous en `GENERE` pour un meme eleve : seule la
 * regeneration individuelle marquait l'ancien. Filtrer sur le statut laissait
 * donc passer jusqu'a cinq bulletins pour le meme eleve, constate en base.
 * C'est corrige a la source, mais les documents deja empiles existent : la
 * regle retenue ne fait donc pas confiance au seul statut et garde **le plus
 * recent des `GENERE`**.
 *
 * Les documents doivent arriver **tries du plus recent au plus ancien**.
 */
export function bulletinsCourantsParEleve(
  documents: DocumentBulletin[],
): Map<string, EtatBulletinEleve> {
  const parEleve = new Map<string, EtatBulletinEleve>();
  for (const document of documents) {
    const entree = parEleve.get(document.eleveId) ?? { courant: null, remplacees: 0 };
    if (document.statut === 'GENERE' && entree.courant === null) {
      entree.courant = document;
    } else {
      entree.remplacees += 1;
    }
    parEleve.set(document.eleveId, entree);
  }
  return parEleve;
}

/** Les seuls documents a telecharger : un par eleve, le plus recent. */
export function bulletinsATelecharger(documents: DocumentBulletin[]): DocumentBulletin[] {
  const courants: DocumentBulletin[] = [];
  for (const etat of bulletinsCourantsParEleve(documents).values()) {
    if (etat.courant) courants.push(etat.courant);
  }
  return courants;
}

/**
 * Nom du fichier sur le disque.
 *
 * L'ancien nom portait la reference du document — « KOFFI Yao - BUL-2026-0042 »
 * — ce qui etait utile tant qu'un eleve pouvait avoir plusieurs fichiers dans
 * le meme dossier : il fallait bien les distinguer. Maintenant qu'un seul
 * bulletin par eleve est telecharge, la reference ne distingue plus rien et ne
 * dit rien de lisible. Une secretaire qui distribue des bulletins les range par
 * nom d'eleve, pas par numero de document.
 *
 * **Le matricule reste**, et ce n'est pas de la decoration : deux eleves d'une
 * meme classe peuvent porter les memes nom et prenoms. Sans lui, le second
 * ecraserait silencieusement le premier dans le dossier choisi — une perte de
 * fichier qu'aucun message ne signalerait.
 */
export function nomFichierBulletin(
  nomComplet: string,
  matricule: string | null,
  periode: string,
): string {
  const identite = matricule ? `${nomComplet} - ${matricule}` : nomComplet;
  return `${identite} - ${libellePeriode(periode)}.pdf`;
}

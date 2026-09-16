/**
 * D'où vient une demande de démo.
 *
 * Le formulaire public est le seul appel à l'action de tout le site, et trois
 * chemins très différents y mènent : le bandeau d'accueil, le bouton de la
 * barre de navigation, et **les trois offres de la grille tarifaire**. Jusqu'au
 * 2026-09-16, les trois arrivaient identiques dans la file du SUPER_ADMIN : on
 * ne savait pas si l'on rappelait une école qui découvre le produit ou une
 * école qui vient de cliquer « Rejoindre le programme » sur l'offre fondatrice
 * — c'est-à-dire la conversation la plus avancée que le site sache produire.
 *
 * Module sans dépendance, délibérément : la grille tarifaire et le formulaire
 * sont des composants clients, l'écran du SUPER_ADMIN et le service sont côté
 * serveur. Importer un service depuis un composant client ferait entrer
 * `next/headers` dans le bundle (panne du 2026-09-02).
 *
 * **L'origine est déclarée par le navigateur du visiteur**, via un paramètre
 * d'URL, et l'écriture de `demande_demo` est publique. C'est donc une
 * indication commerciale, jamais une preuve : quelqu'un peut annoncer
 * `fondateur` sans être passé par l'offre. Aucune décision automatique ne doit
 * en découler — l'admission au programme fondateur reste un geste manuel du
 * SUPER_ADMIN, comme avant.
 */

export type OrigineDemande =
  /** Bandeau d'accueil, barre de navigation, bannière finale — aucune offre nommée. */
  | 'DIRECT'
  | 'OFFRE_1_CYCLE'
  | 'OFFRE_2_CYCLES'
  | 'PROGRAMME_FONDATEUR';

export const ORIGINES: OrigineDemande[] = [
  'DIRECT',
  'OFFRE_1_CYCLE',
  'OFFRE_2_CYCLES',
  'PROGRAMME_FONDATEUR',
];

/**
 * Valeur portée par l'URL, et non l'identifiant lui-même : l'adresse est
 * visible du visiteur, et `?offre=fondateur` se lit mieux que
 * `?offre=PROGRAMME_FONDATEUR`. Le nom interne peut changer sans casser un lien
 * partagé.
 */
export const PARAMETRE_OFFRE = 'offre';

const PAR_JETON: Record<string, OrigineDemande> = {
  'un-cycle': 'OFFRE_1_CYCLE',
  'deux-cycles': 'OFFRE_2_CYCLES',
  fondateur: 'PROGRAMME_FONDATEUR',
};

/** Jeton d'URL d'une origine, ou `null` quand elle n'en a pas (`DIRECT`). */
export function jetonDe(origine: OrigineDemande): string | null {
  const entree = Object.entries(PAR_JETON).find(([, valeur]) => valeur === origine);
  return entree ? entree[0] : null;
}

/**
 * Lit l'origine d'une adresse. Tout ce qui n'est pas reconnu vaut `DIRECT` :
 * le paramètre vient de l'extérieur, et une valeur inventée ne doit pas faire
 * échouer l'envoi d'un prospect — perdre une demande coûte infiniment plus cher
 * que perdre son attribution.
 */
export function lireOrigine(recherche: string): OrigineDemande {
  try {
    const jeton = new URLSearchParams(recherche).get(PARAMETRE_OFFRE);
    return (jeton && PAR_JETON[jeton]) || 'DIRECT';
  } catch {
    return 'DIRECT';
  }
}

/** Normalise ce qui arrive du formulaire, avant écriture. */
export function normaliserOrigine(valeur: unknown): OrigineDemande {
  return ORIGINES.includes(valeur as OrigineDemande) ? (valeur as OrigineDemande) : 'DIRECT';
}

/** Ce que le SUPER_ADMIN lit sur la carte du prospect. */
export const LIBELLE_ORIGINE: Record<OrigineDemande, string> = {
  DIRECT: 'Demande directe',
  OFFRE_1_CYCLE: 'Offre un cycle',
  OFFRE_2_CYCLES: 'Offre collège et lycée',
  PROGRAMME_FONDATEUR: 'Programme fondateur',
};

/**
 * Phrase complète pour le SUPER_ADMIN, qui rappelle **ce que le visiteur a vu**
 * avant d'écrire. C'est ce qui change la première phrase de l'appel : on ne
 * réexplique pas le produit à quelqu'un qui a déjà lu l'offre et choisi.
 */
export const CONTEXTE_ORIGINE: Record<OrigineDemande, string> = {
  DIRECT: 'Est arrivé par un bouton général du site, sans offre choisie.',
  OFFRE_1_CYCLE: 'A choisi l’offre à un cycle : un collège seul ou un lycée seul.',
  OFFRE_2_CYCLES: 'A choisi l’offre à deux cycles : un complexe collège et lycée.',
  PROGRAMME_FONDATEUR:
    'A cliqué « Rejoindre le programme » sur l’offre fondatrice — tarif préférentiel garanti à vie, accompagnement et places comptées.',
};

/** L'origine mérite-t-elle d'être signalée d'emblée ? */
export function estPrioritaire(origine: OrigineDemande): boolean {
  return origine === 'PROGRAMME_FONDATEUR';
}

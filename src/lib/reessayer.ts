/**
 * Une seconde chance pour une lecture qui a échoué sans faute de personne.
 *
 * **Ce module ne dépend de rien** : il est employé par le middleware, qui
 * tourne dans un contexte où l'on ne tire rien de superflu.
 *
 * ## Ce qu'il répare
 *
 * Les journaux de la base montrent une à quatre réponses `504` par heure, à
 * toute heure — y compris la nuit, hors de toute activité de développement.
 * Ce ne sont pas des défauts du produit : c'est le comportement de la
 * passerelle sous charge. Ils frappent des lectures triviales (l'abonnement,
 * les cycles, l'onboarding) et suffisent à faire tomber la page, parce que les
 * services lèvent sur `error`.
 *
 * Une lecture est **rejouable sans conséquence** : la relancer une fois coûte
 * quelques dizaines de millisecondes et transforme une page en erreur en une
 * page légèrement plus lente. C'est l'échange évident.
 *
 * ## Ce qu'il ne fait pas
 *
 * **Il ne rejoue jamais une écriture.** Rejouer un encaissement dont la réponse
 * s'est perdue, c'est encaisser deux fois — le produit l'a payé le 2026-09-13.
 * Les écritures ont leur propre mécanisme, la clé d'idempotence et
 * `executerUneSeuleFois` ; celui-ci n'est pas un substitut et ne doit jamais
 * l'être. Le nom le dit : `reessayerLecture`.
 *
 * **Il ne boucle pas.** Une seule reprise. Si la base est réellement en panne,
 * marteler ne la répare pas et retarde l'aveu ; le deuxième échec est une
 * information, pas un cas à réessayer.
 */

/** Attente avant la reprise. Assez pour laisser passer un à-coup, pas assez pour se voir. */
const REPOS_MS = 120;

/**
 * Exécute une lecture, et la rejoue **une fois** si elle échoue.
 *
 * `lecture` doit rendre un objet à la façon de supabase-js : `{ data, error }`.
 * On ne lève pas ici — c'est à l'appelant de décider ce que vaut un second
 * échec, et cette décision n'est pas la même sur un compteur d'affichage et
 * sur le verrou d'abonnement.
 */
export async function reessayerLecture<T>(
  lecture: () => Promise<{ data: T; error: unknown }>,
): Promise<{ data: T; error: unknown; reprise: boolean }> {
  const premier = await lecture();
  if (!premier.error) return { ...premier, reprise: false };

  await new Promise((resoudre) => setTimeout(resoudre, REPOS_MS));
  const second = await lecture();
  return { ...second, reprise: true };
}

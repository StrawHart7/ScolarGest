/**
 * Vocabulaire des ecritures differees — sans aucune dependance.
 *
 * Ce module est importe des deux cotes de la frontiere : par la file d'attente
 * qui tourne dans le navigateur, et par le service qui applique l'operation
 * sur le serveur. Il ne doit donc jamais importer `src/services/`, sous peine
 * de tirer `next/headers` dans un bundle client — panne du 2026-09-02, deja
 * documentee dans `CLAUDE.md`.
 */

/**
 * Nature d'une operation mise en file.
 *
 * Le type accompagne la cle d'idempotence jusqu'en base : une meme cle
 * rejouee sous un autre type est refusee, plutot que de rendre le resultat
 * d'un encaissement a une soumission de notes.
 */
export type TypeOperation =
  | 'SAISIE_NOTE'
  | 'SOUMISSION_NOTES'
  | 'DEMANDE_CORRECTION'
  | 'PAIEMENT';

/**
 * Une operation deja appliquee rend le resultat de sa premiere application.
 *
 * `rejeu` sans `achevee` decrit un troisieme etat, ni « neuve » ni
 * « terminee » : une autre execution detient la reclamation et travaille
 * encore. La file doit alors attendre, surtout pas executer.
 */
export interface EtatOperation<T = unknown> {
  rejeu: boolean;
  achevee: boolean;
  resultat: T | null;
}

/**
 * Fabrique une cle d'idempotence.
 *
 * `crypto.randomUUID` n'existe pas sur les navigateurs anciens ni hors
 * contexte securise ; le repli n'a pas besoin d'etre cryptographique, il a
 * besoin d'etre unique sur un appareil. Une collision se solderait par une
 * ecriture refusee comme rejeu, pas par une corruption.
 */
export function nouvelleCleOperation(): string {
  const c = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const octets = new Uint8Array(16);
  if (c && typeof c.getRandomValues === 'function') {
    c.getRandomValues(octets);
  } else {
    for (let i = 0; i < 16; i += 1) octets[i] = Math.floor(Math.random() * 256);
  }
  // Version 4, variante RFC 4122 — la colonne est un `uuid` en base, une
  // chaine libre serait refusee a l'insertion.
  octets[6] = ((octets[6] ?? 0) & 0x0f) | 0x40;
  octets[8] = ((octets[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(octets, (o) => o.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

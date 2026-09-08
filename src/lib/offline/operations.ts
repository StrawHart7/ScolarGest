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
export const TYPES_OPERATION = [
  'SAISIE_NOTE',
  'SOUMISSION_NOTES',
  'DEMANDE_CORRECTION',
  'PAIEMENT',
  'SIGNALEMENT_INCIDENT',
] as const;

export type TypeOperation = (typeof TYPES_OPERATION)[number];

/**
 * Liste fermee et **valeur**, pas seulement un type : le serveur recoit ce
 * champ d'un appelant et doit pouvoir le refuser. Un type libre laisserait
 * ecrire n'importe quoi dans la colonne `type`, et l'unicite par cle ne
 * protegerait plus contre une meme cle rejouee sous un autre libelle.
 */
export function estTypeOperation(valeur: unknown): valeur is TypeOperation {
  return typeof valeur === 'string' && (TYPES_OPERATION as readonly string[]).includes(valeur);
}

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

/**
 * Message lisible tire de n'importe quelle erreur.
 *
 * Les erreurs Supabase **ne sont pas des `Error`** : ce sont des objets
 * simples. `e instanceof Error` est donc toujours faux, et les Server Actions
 * du depot remplacaient la cause reelle — contrainte violee, refus RLS — par
 * un message generique. Piege deja documente dans `CLAUDE.md`, ici outille.
 *
 * Ce module n'a pas de directive `'use client'` : la fonction sert des deux
 * cotes, dans la file du navigateur comme dans une Server Action.
 */
export function messageErreur(e: unknown): string {
  if (typeof e === 'string') return e;
  if (e instanceof Error && e.message) return e.message;
  if (e && typeof e === 'object') {
    const o = e as Record<string, unknown>;
    const parties = [o.message, o.details, o.hint].filter(
      (p): p is string => typeof p === 'string' && p.length > 0,
    );
    if (parties.length > 0) return parties.join(' — ');
    if (typeof o.code === 'string') return `Code ${o.code}`;
  }
  return 'Erreur inconnue';
}

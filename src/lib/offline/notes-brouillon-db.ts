'use client';

import { ouvrirBase, effacerToutLeLocal, type RowStateBrouillon } from './db';

/**
 * Brouillons de saisie de notes non encore enregistres cote serveur.
 * Protege contre la perte de saisie lors d'un rechargement ou d'une coupure
 * (voir `SaisieNotesForm.tsx`).
 *
 * La donnee persistee EST la file d'attente pour ce cas precis : une ligne
 * `dirty` est une ligne restant a envoyer via `saisirNoteAction`, qui est un
 * upsert sur `(evaluationId, eleveId)` — donc rejouable sans consequence. Il
 * n'y a pas de structure de file separee a maintenir en double.
 *
 * Cette equivalence ne s'etend pas aux operations qui ne sont pas des upserts
 * (soumission d'evaluation, versement) : celles-la passent par
 * `file-attente.ts` et une cle d'idempotence.
 *
 * Cle composite `${userId}:${evaluationId}` — namespacee par utilisateur pour
 * qu'un brouillon ne soit jamais restaure sous un autre compte sur un poste
 * partage (voir `effacerTousBrouillons`, appelee a la deconnexion).
 *
 * L'ouverture de la base vit desormais dans `db.ts` : deux modules ouvrant la
 * meme base a deux versions differentes, le second echoue.
 */

export type { RowStateBrouillon };

const MAGASIN = 'notes-brouillon' as const;

function cle(userId: string, evaluationId: string): string {
  return `${userId}:${evaluationId}`;
}

export async function lireBrouillon(
  userId: string,
  evaluationId: string,
): Promise<Record<string, RowStateBrouillon> | null> {
  try {
    const db = await ouvrirBase();
    const record = await db.get(MAGASIN, cle(userId, evaluationId));
    return record?.rows ?? null;
  } catch {
    return null;
  }
}

export async function ecrireBrouillon(
  userId: string,
  evaluationId: string,
  rows: Record<string, RowStateBrouillon>,
): Promise<void> {
  try {
    const db = await ouvrirBase();
    await db.put(MAGASIN, {
      cle: cle(userId, evaluationId),
      userId,
      evaluationId,
      rows,
      misAJourLe: Date.now(),
    });
  } catch {
    // Pas de brouillon local persiste cette fois-ci — la saisie continue
    // normalement en memoire, seule la reprise apres coupure est perdue.
  }
}

export async function effacerBrouillon(userId: string, evaluationId: string): Promise<void> {
  try {
    const db = await ouvrirBase();
    await db.delete(MAGASIN, cle(userId, evaluationId));
  } catch {
    // Au pire un brouillon obsolete reste en cache local, sans consequence :
    // il n'est relu que pour cette evaluation, et ses lignes non dirty sont
    // ignorees.
  }
}

/**
 * Balayage complet a la deconnexion (poste partage).
 *
 * Efface desormais le cache de consultation et la file en plus des
 * brouillons : depuis que des donnees d'etablissement sont stockees
 * localement, n'en effacer qu'une partie exposerait l'ecole au compte suivant.
 */
export async function effacerTousBrouillons(): Promise<void> {
  await effacerToutLeLocal();
}

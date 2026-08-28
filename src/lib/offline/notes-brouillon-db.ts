'use client';

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

/**
 * Persistance locale (IndexedDB) des brouillons de saisie de notes non
 * encore enregistrés côté serveur. Protège contre la perte de saisie lors
 * d'un rechargement ou d'une coupure réseau (voir `SaisieNotesForm.tsx`).
 *
 * La donnée persistée EST la file d'attente de synchronisation : une ligne
 * `dirty: true` est une ligne restant à envoyer via `saisirNoteAction`, il
 * n'y a pas de structure de file séparée à maintenir en double.
 *
 * Clé composite `${userId}:${evaluationId}` — namespacée par utilisateur
 * pour qu'un brouillon ne soit jamais restauré sous un autre compte sur un
 * poste partagé (voir `effacerTousBrouillons`, appelée à la déconnexion).
 *
 * Toutes les fonctions avalent leurs erreurs (quota dépassé, navigation
 * privée stricte, IndexedDB indisponible) : l'absence de brouillon local ne
 * doit jamais faire planter le formulaire, seulement dégrader la
 * récupération en cas de coupure — même posture défensive que
 * `src/components/pwa/pwa-installer.tsx` pour l'enregistrement du SW.
 */

export interface RowStateBrouillon {
  valeur: string;
  observation: string;
  dirty: boolean;
}

interface BrouillonRecord {
  cle: string;
  userId: string;
  evaluationId: string;
  rows: Record<string, RowStateBrouillon>;
  misAJourLe: number;
}

interface NotesBrouillonDB extends DBSchema {
  'notes-brouillon': {
    key: string;
    value: BrouillonRecord;
  };
}

const DB_NAME = 'scolargest-offline';
const STORE_NAME = 'notes-brouillon';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<NotesBrouillonDB>> | null = null;

function getDb(): Promise<IDBPDatabase<NotesBrouillonDB>> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB indisponible'));
  }
  if (!dbPromise) {
    dbPromise = openDB<NotesBrouillonDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'cle' });
        }
      },
    });
  }
  return dbPromise;
}

function cle(userId: string, evaluationId: string): string {
  return `${userId}:${evaluationId}`;
}

export async function lireBrouillon(
  userId: string,
  evaluationId: string,
): Promise<Record<string, RowStateBrouillon> | null> {
  try {
    const db = await getDb();
    const record = await db.get(STORE_NAME, cle(userId, evaluationId));
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
    const db = await getDb();
    await db.put(STORE_NAME, {
      cle: cle(userId, evaluationId),
      userId,
      evaluationId,
      rows,
      misAJourLe: Date.now(),
    });
  } catch {
    // Pas de brouillon local persisté cette fois-ci — la saisie continue
    // normalement en mémoire, seule la récupération après coupure est perdue.
  }
}

export async function effacerBrouillon(userId: string, evaluationId: string): Promise<void> {
  try {
    const db = await getDb();
    await db.delete(STORE_NAME, cle(userId, evaluationId));
  } catch {
    // Rien à faire : au pire un brouillon obsolète reste en cache local,
    // sans conséquence puisqu'il ne sera relu que si dirty pour cet évaluation.
  }
}

/** Balayage complet, appelé à la déconnexion (poste partagé). */
export async function effacerTousBrouillons(): Promise<void> {
  try {
    const db = await getDb();
    await db.clear(STORE_NAME);
  } catch {
    // Idem : dégrade silencieusement, ne bloque jamais la déconnexion.
  }
}

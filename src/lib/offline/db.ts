'use client';

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { TypeOperation } from './operations';

/**
 * Ouverture unique de la base locale.
 *
 * Deux modules ouvraient `scolargest-offline`, l'un en version 1 pour les
 * brouillons, l'autre en version 2 pour la file : le second `openDB` echoue
 * avec « the requested version is less than the existing version », et le
 * formulaire de saisie perdait sa persistance sans le moindre message. Une
 * base, une version, un seul point d'ouverture — les autres modules passent
 * par ici.
 *
 * Toutes les fonctions de ce dossier avalent leurs erreurs. IndexedDB est
 * indisponible en navigation privee stricte, peut refuser un quota, et une
 * base absente ne doit jamais empecher de saisir : elle degrade la reprise
 * apres coupure, elle ne casse pas l'ecran.
 */

export interface RowStateBrouillon {
  valeur: string;
  observation: string;
  dirty: boolean;
}

export interface BrouillonRecord {
  cle: string;
  userId: string;
  evaluationId: string;
  rows: Record<string, RowStateBrouillon>;
  misAJourLe: number;
}

/**
 * Une ecriture en attente d'envoi.
 *
 * La cle primaire **est** la cle d'idempotence transmise au serveur. Deux
 * files ne peuvent donc pas diverger : ce qui est stocke localement est
 * exactement ce qui identifiera l'operation cote serveur.
 */
export interface OperationEnFile {
  cle: string;
  userId: string;
  etablissementId: string;
  type: TypeOperation;
  /** Charge utile serialisable, telle que le gestionnaire l'attend. */
  charge: unknown;
  /** Phrase courte affichable a l'utilisateur : « Versement de 25 000 F ». */
  intitule: string;
  creeLe: number;
  tentatives: number;
  /** Horodatage avant lequel il ne faut pas reessayer (recul exponentiel). */
  prochaineTentative: number;
  dernierEchec?: string;
}

/** Une donnee mise en cache pour la consultation hors ligne. */
export interface EntreeCache {
  cle: string;
  userId: string;
  donnees: unknown;
  misAJourLe: number;
}

interface BaseLocale extends DBSchema {
  'notes-brouillon': { key: string; value: BrouillonRecord };
  'file-operations': {
    key: string;
    value: OperationEnFile;
    indexes: { 'par-utilisateur': string };
  };
  cache: { key: string; value: EntreeCache; indexes: { 'par-utilisateur': string } };
}

const NOM_BASE = 'scolargest-offline';
const VERSION = 2;

let promesse: Promise<IDBPDatabase<BaseLocale>> | null = null;

export function ouvrirBase(): Promise<IDBPDatabase<BaseLocale>> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB indisponible'));
  }
  if (!promesse) {
    promesse = openDB<BaseLocale>(NOM_BASE, VERSION, {
      // `upgrade` recoit l'ancienne version : une base v1 existante conserve
      // ses brouillons, on n'ajoute que les magasins manquants. Recreer
      // `notes-brouillon` effacerait la saisie non envoyee d'un enseignant.
      upgrade(db) {
        if (!db.objectStoreNames.contains('notes-brouillon')) {
          db.createObjectStore('notes-brouillon', { keyPath: 'cle' });
        }
        if (!db.objectStoreNames.contains('file-operations')) {
          const magasin = db.createObjectStore('file-operations', { keyPath: 'cle' });
          magasin.createIndex('par-utilisateur', 'userId');
        }
        if (!db.objectStoreNames.contains('cache')) {
          const magasin = db.createObjectStore('cache', { keyPath: 'cle' });
          magasin.createIndex('par-utilisateur', 'userId');
        }
      },
    });
  }
  return promesse;
}

/**
 * Balayage complet, appele a la deconnexion.
 *
 * Vide les trois magasins et non le seul brouillon : depuis que le cache
 * contient des donnees d'etablissement — listes d'eleves, factures — laisser
 * l'un des deux derriere reviendrait a exposer l'ecole au compte suivant sur
 * un poste partage. C'est la contrepartie assumee de la consultation hors
 * ligne.
 *
 * **La file est videe elle aussi.** Une ecriture en attente appartient a la
 * session qui l'a produite ; la rejouer sous un autre compte l'attribuerait a
 * la mauvaise personne dans le journal d'audit. L'utilisateur est averti
 * avant de se deconnecter avec des ecritures en attente (voir
 * `DeconnexionButton`).
 */
export async function effacerToutLeLocal(): Promise<void> {
  try {
    const db = await ouvrirBase();
    await Promise.all([
      db.clear('notes-brouillon'),
      db.clear('file-operations'),
      db.clear('cache'),
    ]);
  } catch {
    // Degrade en silence : ne jamais bloquer une deconnexion.
  }
}

'use client';

import { ouvrirBase, type OperationEnFile } from './db';
import { messageErreur, nouvelleCleOperation, type TypeOperation } from './operations';

export { messageErreur };

/**
 * File d'attente des ecritures differees.
 *
 * Le premier increment hors-ligne n'avait pas de file : les brouillons de
 * notes en tenaient lieu, parce qu'une ligne `dirty` **est** une ligne restant
 * a envoyer. Cette equivalence tenait tant que la seule ecriture concernee
 * etait un upsert, rejouable sans consequence. Elle ne s'etend pas a un
 * versement, ni a une soumission d'evaluation qui change un statut.
 *
 * D'ou une file explicite. Elle ne remplace pas les brouillons — ceux-ci
 * restent la bonne structure pour une saisie en cours, modifiable ligne a
 * ligne. Elle recueille les **operations validees** que le reseau n'a pas
 * encore emportees.
 *
 * Trois proprietes, chacune payee par une erreur qu'on ne veut pas commettre :
 *
 * - **Ordre d'arrivee.** Une soumission d'evaluation posterieure a une saisie
 *   doit partir apres elle, sinon le serveur verrouille l'evaluation avant
 *   d'avoir recu la derniere note.
 * - **Recul exponentiel.** Un serveur qui refuse pour une raison durable ne
 *   doit pas etre martele toutes les secondes pendant six heures de coupure ;
 *   la batterie de l'appareil est une ressource, elle aussi.
 * - **Un echec n'arrete pas la file.** Une operation refusee est mise de cote
 *   avec son motif ; les suivantes partent. Bloquer sur la premiere ferait
 *   perdre une journee de saisie a cause d'une seule ligne fautive.
 */

/** Recul entre deux tentatives, plafonne. */
const RECULS_MS = [0, 5_000, 30_000, 2 * 60_000, 10 * 60_000, 30 * 60_000];

/**
 * Au-dela, l'operation cesse d'etre reessayee automatiquement et attend une
 * decision humaine. Elle n'est jamais supprimee : perdre silencieusement un
 * encaissement serait pire que de le laisser en attente visible.
 */
export const TENTATIVES_AVANT_ABANDON = RECULS_MS.length;

export function reculMs(tentatives: number): number {
  return RECULS_MS[Math.min(Math.max(tentatives, 0), RECULS_MS.length - 1)] ?? 0;
}

export interface DemandeMiseEnFile {
  userId: string;
  etablissementId: string;
  type: TypeOperation;
  charge: unknown;
  intitule: string;
  /**
   * Cle d'idempotence. Fournie par l'appelant quand l'operation a deja ete
   * tentee en ligne et qu'on ne sait pas si elle est passee — c'est exactement
   * le cas ou rejouer est dangereux, et ou la meme cle doit etre reutilisee.
   */
  cle?: string;
}

/** Depose une operation dans la file. Rend sa cle d'idempotence. */
export async function enfiler(demande: DemandeMiseEnFile): Promise<string> {
  const cle = demande.cle ?? nouvelleCleOperation();
  try {
    const db = await ouvrirBase();
    const existante = await db.get('file-operations', cle);
    // Reprise d'une operation deja en file : on garde son compteur et son
    // rang d'arrivee plutot que de la remettre en fin de file.
    await db.put('file-operations', {
      cle,
      userId: demande.userId,
      etablissementId: demande.etablissementId,
      type: demande.type,
      charge: demande.charge,
      intitule: demande.intitule,
      creeLe: existante?.creeLe ?? Date.now(),
      tentatives: existante?.tentatives ?? 0,
      prochaineTentative: existante?.prochaineTentative ?? 0,
      dernierEchec: existante?.dernierEchec,
    });
  } catch {
    // IndexedDB indisponible : l'appelant reste libre de tenter l'envoi
    // direct. Il rendra la main avec une erreur si le reseau manque aussi.
  }
  return cle;
}

/** Operations en attente pour un utilisateur, dans leur ordre d'arrivee. */
export async function listerFile(userId: string): Promise<OperationEnFile[]> {
  try {
    const db = await ouvrirBase();
    const toutes = await db.getAllFromIndex('file-operations', 'par-utilisateur', userId);
    return toutes.sort((a, b) => a.creeLe - b.creeLe);
  } catch {
    return [];
  }
}

export async function compterFile(userId: string): Promise<number> {
  return (await listerFile(userId)).length;
}

export async function retirerDeLaFile(cle: string): Promise<void> {
  try {
    const db = await ouvrirBase();
    await db.delete('file-operations', cle);
  } catch {
    // L'operation a abouti cote serveur ; une trace locale residuelle sera
    // reconnue comme rejeu et rendra le meme resultat. Sans consequence.
  }
}

/**
 * Un gestionnaire applique une operation. Il recoit la charge et la cle
 * d'idempotence, et appelle la Server Action correspondante.
 *
 * Les gestionnaires sont **injectes** et non importes ici : ce module doit
 * rester testable sans Next, et surtout ne jamais tirer de Server Action dans
 * un contexte ou elle n'a pas lieu d'etre.
 */
export type Gestionnaire = (charge: unknown, cle: string) => Promise<void>;
export type Gestionnaires = Partial<Record<TypeOperation, Gestionnaire>>;

export interface BilanVidage {
  envoyees: number;
  echouees: number;
  reportees: number;
}

/**
 * Tente d'envoyer la file. Rend un bilan, sans jamais lever.
 *
 * `maintenant` est un parametre et non `Date.now()` en dur : c'est ce qui rend
 * le recul exponentiel testable sans attendre trente minutes.
 */
export async function viderFile(
  userId: string,
  gestionnaires: Gestionnaires,
  maintenant: number = Date.now(),
): Promise<BilanVidage> {
  const bilan: BilanVidage = { envoyees: 0, echouees: 0, reportees: 0 };
  const operations = await listerFile(userId);

  for (const operation of operations) {
    if (operation.prochaineTentative > maintenant) {
      bilan.reportees += 1;
      continue;
    }
    if (operation.tentatives >= TENTATIVES_AVANT_ABANDON) {
      // Epuisee : elle reste visible et attend une reprise manuelle.
      bilan.reportees += 1;
      continue;
    }

    const gestionnaire = gestionnaires[operation.type];
    if (!gestionnaire) {
      // Type inconnu de cette version du client — une operation deposee par
      // une version plus recente, apres mise a jour differee. On la laisse en
      // place plutot que de la jeter.
      bilan.reportees += 1;
      continue;
    }

    try {
      await gestionnaire(operation.charge, operation.cle);
      await retirerDeLaFile(operation.cle);
      bilan.envoyees += 1;
    } catch (e) {
      bilan.echouees += 1;
      const tentatives = operation.tentatives + 1;
      try {
        const db = await ouvrirBase();
        await db.put('file-operations', {
          ...operation,
          tentatives,
          prochaineTentative: maintenant + reculMs(tentatives),
          dernierEchec: messageErreur(e),
        });
      } catch {
        // On perd le compteur de tentatives, pas l'operation.
      }
    }
  }

  return bilan;
}

/**
 * Nombre total d'ecritures en attente sur cet appareil, tous comptes
 * confondus.
 *
 * Sans filtre sur l'utilisateur, delibrement : c'est la question posee au
 * moment de la deconnexion, ou l'on s'apprete a tout effacer. Compter le seul
 * compte courant laisserait partir sans un mot les ecritures d'un collegue qui
 * a saisi avant lui sur le meme poste.
 */
export async function compterFileTotale(): Promise<number> {
  try {
    const db = await ouvrirBase();
    return await db.count('file-operations');
  } catch {
    return 0;
  }
}

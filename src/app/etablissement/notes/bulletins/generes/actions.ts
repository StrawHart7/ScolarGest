'use server';

import { z } from 'zod';
import { getUrlTelechargementDocument, listBulletinsClasse } from '@/services/document';
import { listElevesInscritsClasse } from '@/services/eleve';
import { bulletinsATelecharger, nomFichierBulletin } from '@/lib/bulletins';

const uuidSchema = z.string().uuid();

export interface TelechargementResult {
  error: string | null;
  url?: string;
}

/**
 * URL signée (5 minutes) vers le PDF d'un bulletin prêt.
 *
 * Le lien n'est pas rendu dans la page : une URL signée posée dans le HTML
 * serait périmée avant même que la page soit relue, et figurerait dans le
 * cache du navigateur. Elle est demandée au moment du clic.
 *
 * Le périmètre tenant est vérifié par `getUrlTelechargementDocument`, qui
 * relit le document avec la session avant de signer avec la clé service-role :
 * un identifiant forgé ne sort pas de son établissement.
 */
export async function telechargerBulletinAction(documentId: string): Promise<TelechargementResult> {
  const parsed = uuidSchema.safeParse(documentId);
  if (!parsed.success) return { error: 'Document invalide' };

  try {
    const url = await getUrlTelechargementDocument(parsed.data);
    return { error: null, url };
  } catch (e) {
    // Les erreurs Supabase ne sont pas des `Error` : un test `instanceof`
    // masquerait la cause réelle derrière un message générique.
    const message =
      e instanceof Error
        ? e.message
        : ((e as { message?: string })?.message ?? 'Le téléchargement a échoué.');
    return { error: message };
  }
}

export interface FichierBulletin {
  /** « KOFFI Yao - MAT-2026-0031 - Trimestre 1.pdf » — voir `lib/bulletins`. */
  nomFichier: string;
  url: string;
}

/**
 * Liens de téléchargement de tous les bulletins en vigueur d'une classe.
 *
 * Une seule action pour toute la classe, plutôt qu'un aller-retour par élève :
 * vingt actions successives depuis le navigateur, c'est vingt occasions
 * d'échouer à mi-parcours sur une connexion instable, et l'utilisateur se
 * retrouverait avec un dossier à moitié rempli sans savoir lesquels manquent.
 *
 * **Un seul bulletin par élève : le plus récent.** Filtrer sur le statut ne
 * suffisait pas. La génération groupée empilait des documents tous en `GENERE`
 * pour un même élève, et le dossier se remplissait de toutes les versions sans
 * qu'aucun nom de fichier ne dise laquelle faisait foi. La source est
 * corrigée, mais les documents déjà empilés existent : le regroupement par
 * élève reste donc la règle, et il est partagé avec l'écran par
 * `src/lib/bulletins.ts` — le décider ici une seconde fois ferait diverger les
 * deux affichages.
 *
 * Les URL sont signées 5 minutes. C'est court, mais l'appelant les consomme
 * immédiatement ; les poser dans le HTML de la page les rendrait périmées
 * avant le premier clic.
 */
export async function urlsBulletinsClasseAction(
  classeId: string,
  periode: string,
  anneeScolaireId: string,
): Promise<{ error: string | null; fichiers: FichierBulletin[] }> {
  const classe = uuidSchema.safeParse(classeId);
  const annee = uuidSchema.safeParse(anneeScolaireId);
  const periodeAnalysee = z.enum(['TRIMESTRE_1', 'TRIMESTRE_2', 'TRIMESTRE_3']).safeParse(periode);
  if (!classe.success || !annee.success || !periodeAnalysee.success) {
    return { error: 'Paramètres invalides', fichiers: [] };
  }

  try {
    const [eleves, documents] = await Promise.all([
      listElevesInscritsClasse(classe.data, annee.data),
      listBulletinsClasse(classe.data, periodeAnalysee.data),
    ]);
    const parEleve = new Map(eleves.map((e) => [e.id, e]));

    const fichiers: FichierBulletin[] = [];
    for (const document of bulletinsATelecharger(documents)) {
      const url = await getUrlTelechargementDocument(document.documentId);
      const eleve = parEleve.get(document.eleveId);
      fichiers.push({
        nomFichier: nomFichierBulletin(
          eleve ? `${eleve.nom} ${eleve.prenoms}` : 'Eleve',
          eleve?.matricule ?? null,
          periodeAnalysee.data,
        ),
        url,
      });
    }

    // Tri alphabetique : une secretaire distribue les bulletins dans l'ordre
    // de sa liste de classe, pas dans l'ordre de generation.
    fichiers.sort((a, b) => a.nomFichier.localeCompare(b.nomFichier, 'fr'));

    return { error: null, fichiers };
  } catch (e) {
    const message =
      e instanceof Error
        ? e.message
        : ((e as { message?: string })?.message ?? 'La préparation des téléchargements a échoué.');
    return { error: message, fichiers: [] };
  }
}

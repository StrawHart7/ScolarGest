'use server';

import { z } from 'zod';
import { getUrlTelechargementDocument, listBulletinsClasse } from '@/services/document';
import { listElevesInscritsClasse } from '@/services/eleve';

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
  /** Nom de fichier lisible, pas la référence seule : « KOFFI Yao - BUL-...pdf ». */
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
 * Les documents OBSOLETE sont exclus : on télécharge ce qui fait foi, pas les
 * versions qu'une régénération a remplacées.
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
    const nomParEleve = new Map(eleves.map((e) => [e.id, `${e.nom} ${e.prenoms}`]));

    const enVigueur = documents.filter((d) => d.statut === 'GENERE');
    const fichiers: FichierBulletin[] = [];
    for (const document of enVigueur) {
      const url = await getUrlTelechargementDocument(document.documentId);
      const nom = nomParEleve.get(document.eleveId) ?? 'Eleve';
      fichiers.push({ nomFichier: `${nom} - ${document.reference}.pdf`, url });
    }

    return { error: null, fichiers };
  } catch (e) {
    const message =
      e instanceof Error
        ? e.message
        : ((e as { message?: string })?.message ?? 'La préparation des téléchargements a échoué.');
    return { error: message, fichiers: [] };
  }
}

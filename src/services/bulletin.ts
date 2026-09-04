import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from './authorization';
import { auditLog } from './audit';
import { getTenantContext } from './tenant';
import { getDonneesBulletin } from './bulletin-donnees';
import { getClasse } from './classe';
import { getAnneeScolaire } from './annee-scolaire';
import { getEtablissement } from './etablissement';
import { getParametresDocument, chargerLogoDataUri } from './parametres-document';
import { generateNumeroDocument } from './document-numero';
import {
  enregistrerDocument,
  marquerObsolete,
  marquerBulletinsPrecedentsObsoletes,
  getDocument,
  type Document,
} from './document';
import { renderHtmlToPdf } from '@/lib/pdf/render';
import { renderBulletinHtml, periodeLabel } from '@/lib/pdf/templates/bulletin';
import { renderBulletinSecondaireHtml } from '@/lib/pdf/templates/bulletin-secondaire';
import type { Periode } from './evaluation';

const BUCKET = 'documents';

interface EleveRow {
  id: string;
  nom: string;
  prenoms: string;
  matricule: string;
  sexe: 'M' | 'F';
  dateNaissance: string;
}

async function getEleveRow(eleveId: string): Promise<EleveRow> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('eleve')
    .select('id, nom, prenoms, matricule, sexe, "dateNaissance"')
    .eq('id', eleveId)
    .single();
  if (error) throw error;
  return data as unknown as EleveRow;
}

async function buildPdf(
  eleveId: string,
  classeId: string,
  periode: Periode,
  anneeScolaireId: string,
  reference: string,
): Promise<Buffer> {
  const [donnees, eleve, classe, annee, etablissement, parametres] = await Promise.all([
    getDonneesBulletin(eleveId, classeId, periode, anneeScolaireId),
    getEleveRow(eleveId),
    getClasse(classeId),
    getAnneeScolaire(anneeScolaireId),
    (async () => {
      const ctx = await getTenantContext();
      return getEtablissement(ctx.etablissementId!);
    })(),
    getParametresDocument(),
  ]);

  // Le logo est intégré en data URI : le bucket est privé, Chromium n'aurait
  // pas de session pour aller le chercher au moment du rendu.
  const identite = {
    logoDataUri: await chargerLogoDataUri(parametres.logoChemin),
    filigraneTexte: parametres.filigraneActif ? parametres.filigraneTexte : null,
  };

  const entree = {
    etablissement: {
      nom: etablissement.nom,
      adresse: etablissement.adresse,
      ville: etablissement.ville,
      telephone: etablissement.telephone,
      email: etablissement.email,
    },
    anneeScolaireLibelle: annee.libelle,
    periodeLabel: periodeLabel(periode),
    eleve: {
      nom: eleve.nom,
      prenoms: eleve.prenoms,
      dateNaissance: eleve.dateNaissance,
      matricule: eleve.matricule,
      sexe: eleve.sexe,
    },
    classeNom: classe.nom,
    reference,
    dateGeneration: new Date().toISOString(),
    donnees,
    identite,
  };

  // Le Collège et le Lycée utilisent le modèle officiel du Ministère fourni
  // par l'établissement ; les autres cycles conservent le gabarit générique.
  const cycle = classe.niveau.cycle?.nom;
  const html =
    cycle === 'COLLEGE' || cycle === 'LYCEE'
      ? renderBulletinSecondaireHtml(entree)
      : renderBulletinHtml(entree);

  return renderHtmlToPdf(html);
}

async function uploadPdf(etablissementId: string, reference: string, pdf: Buffer): Promise<string> {
  const chemin = `${etablissementId}/bulletins/${reference}.pdf`;
  const admin = createAdminClient();
  const { error } = await admin.storage.from(BUCKET).upload(chemin, pdf, {
    contentType: 'application/pdf',
    upsert: false,
  });
  if (error) throw new Error(`Échec de l'upload du bulletin: ${error.message}`);
  return chemin;
}

/**
 * Génère le bulletin PDF d'un élève pour une classe/période/année données,
 * l'archive dans Supabase Storage, enregistre l'entité Document et journalise
 * l'audit. Réservé Directeur/Secrétaire.
 */
export async function genererBulletin(
  eleveId: string,
  classeId: string,
  periode: Periode,
  anneeScolaireId: string,
): Promise<Document> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE');

  const reference = await generateNumeroDocument('BULLETIN', anneeScolaireId);
  const pdf = await buildPdf(eleveId, classeId, periode, anneeScolaireId, reference);
  const cheminFichier = await uploadPdf(ctx.etablissementId!, reference, pdf);

  const document = await enregistrerDocument({
    type: 'BULLETIN',
    reference,
    cheminFichier,
    objetType: 'ELEVE',
    objetId: eleveId,
    // Sans ce contexte, le document ne sait pas de quel trimestre il est : la
    // liste des bulletins déjà édités d'une classe devient impossible à
    // construire, et on régénère à l'aveugle (migration `0025`).
    periode,
    classeId,
    anneeScolaireId,
  });

  // Perime les bulletins precedents du meme eleve pour la meme periode.
  //
  // C'est le defaut corrige : `regenererBulletin` marquait bien l'ancien, mais
  // la generation groupee — qui traite toute la classe — n'en marquait aucun.
  // Rien ne disait donc lequel des documents faisait foi, et le
  // telechargement groupe les sortait tous : jusqu'a cinq bulletins pour le
  // meme eleve, constate en base.
  //
  // **Apres l'insertion, jamais avant.** Perimer d'abord laisserait un eleve
  // sans aucun bulletin en vigueur si le rendu PDF ou l'envoi au stockage
  // echouait — l'ordre est le meme que dans `regenererBulletin`.
  const perimes = await marquerBulletinsPrecedentsObsoletes(
    eleveId,
    classeId,
    periode,
    document.id,
  );

  await auditLog({
    action: 'GENERER_BULLETIN',
    module: 'documents',
    objetType: 'Document',
    objetId: document.id,
    nouvelleValeur: { reference, eleveId, classeId, periode, anneeScolaireId, perimes },
  });

  return document;
}

/**
 * Régénère un bulletin existant: l'ancien document passe OBSOLETE (jamais
 * supprimé, cohérent no-hard-delete), un nouveau est créé GENERE. Le contenu
 * est identique si aucune donnée sous-jacente n'a changé, puisque le PDF est
 * entièrement recalculé depuis les mêmes paramètres (objetId = eleveId,
 * classeId/periode/anneeScolaireId retrouvés depuis la génération courante).
 */
export async function regenererBulletin(
  documentId: string,
  classeId: string,
  periode: Periode,
  anneeScolaireId: string,
): Promise<Document> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE');

  const ancien = await getDocument(documentId);
  if (ancien.type !== 'BULLETIN') {
    throw new Error('Ce document n\'est pas un bulletin.');
  }
  const eleveId = ancien.objetId;

  const reference = await generateNumeroDocument('BULLETIN', anneeScolaireId);
  const pdf = await buildPdf(eleveId, classeId, periode, anneeScolaireId, reference);
  const cheminFichier = await uploadPdf(ctx.etablissementId!, reference, pdf);

  const nouveau = await enregistrerDocument({
    type: 'BULLETIN',
    reference,
    cheminFichier,
    periode,
    classeId,
    anneeScolaireId,
    objetType: 'ELEVE',
    objetId: eleveId,
  });

  await marquerObsolete(documentId);

  await auditLog({
    action: 'REGENERER_BULLETIN',
    module: 'documents',
    objetType: 'Document',
    objetId: nouveau.id,
    ancienneValeur: { documentObsoleteId: documentId, reference: ancien.reference },
    nouvelleValeur: { reference: nouveau.reference, eleveId, classeId, periode, anneeScolaireId },
  });

  return nouveau;
}

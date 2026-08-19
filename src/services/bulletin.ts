import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from './authorization';
import { auditLog } from './audit';
import { getTenantContext } from './tenant';
import { getDonneesBulletin } from './bulletin-donnees';
import { getClasse } from './classe';
import { getAnneeScolaire } from './annee-scolaire';
import { getEtablissement } from './etablissement';
import { generateNumeroDocument } from './document-numero';
import { enregistrerDocument, marquerObsolete, getDocument, type Document } from './document';
import { renderHtmlToPdf } from '@/lib/pdf/render';
import { renderBulletinHtml, periodeLabel } from '@/lib/pdf/templates/bulletin';
import type { Periode } from './evaluation';

const BUCKET = 'documents';

interface EleveRow {
  id: string;
  nom: string;
  prenoms: string;
  matricule: string;
  dateNaissance: string;
}

async function getEleveRow(eleveId: string): Promise<EleveRow> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('eleve')
    .select('id, nom, prenoms, matricule, "dateNaissance"')
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
  const [donnees, eleve, classe, annee, etablissement] = await Promise.all([
    getDonneesBulletin(eleveId, classeId, periode, anneeScolaireId),
    getEleveRow(eleveId),
    getClasse(classeId),
    getAnneeScolaire(anneeScolaireId),
    (async () => {
      const ctx = await getTenantContext();
      return getEtablissement(ctx.etablissementId!);
    })(),
  ]);

  const html = renderBulletinHtml({
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
    },
    classeNom: classe.nom,
    reference,
    dateGeneration: new Date().toISOString(),
    donnees,
  });

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
  });

  await auditLog({
    action: 'GENERER_BULLETIN',
    module: 'documents',
    objetType: 'Document',
    objetId: document.id,
    nouvelleValeur: { reference, eleveId, classeId, periode, anneeScolaireId },
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

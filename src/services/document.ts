import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from './authorization';
import type { Periode } from './evaluation';

export type TypeDocument = 'BULLETIN' | 'RECU' | 'RAPPORT';
export type StatutDocument = 'GENERE' | 'OBSOLETE' | 'ARCHIVE';

export interface Document {
  id: string;
  etablissementId: string;
  type: TypeDocument;
  reference: string;
  cheminFichier: string;
  objetType: string;
  objetId: string;
  dateGeneration: string;
  createdById: string;
  statut: StatutDocument;
  /**
   * Contexte académique, renseigné pour les BULLETIN seulement (migration
   * `0025`). Un reçu n'a pas de trimestre : ces trois colonnes sont nulles pour
   * les autres types de documents, et peuvent l'être pour un bulletin ancien
   * dont la ligne d'audit avait disparu.
   */
  periode: Periode | null;
  classeId: string | null;
  anneeScolaireId: string | null;
}

const DOCUMENT_FIELDS =
  'id, "etablissementId", type, reference, "cheminFichier", "objetType", "objetId", "dateGeneration", "createdById", statut, periode, "classeId", "anneeScolaireId"';

export interface EnregistrerDocumentInput {
  type: TypeDocument;
  reference: string;
  cheminFichier: string;
  objetType: string;
  objetId: string;
  /**
   * Renseigné par la génération de bulletins. Sans lui, un document en base ne
   * sait pas de quel trimestre il est, et la liste des bulletins déjà édités
   * d'une classe est impossible à construire — c'était le cas jusqu'à la
   * migration `0025`.
   */
  periode?: Periode | null;
  classeId?: string | null;
  anneeScolaireId?: string | null;
}

/** Insère une ligne `document` après upload Storage réussi. */
/**
 * Enregistre un document généré. Helper interne appelé par `bulletin.ts` et
 * `recu.ts`, tous deux déjà gardés : la garde est répétée ici parce qu'un
 * service exporté doit se défendre seul, sans supposer de qui il est appelé.
 */
export async function enregistrerDocument(input: EnregistrerDocumentInput): Promise<Document> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE');
  const supabase = createClient();
  const { data, error } = await supabase
    .from('document')
    .insert({
      etablissementId: ctx.etablissementId,
      type: input.type,
      reference: input.reference,
      cheminFichier: input.cheminFichier,
      objetType: input.objetType,
      objetId: input.objetId,
      createdById: ctx.userId,
      statut: 'GENERE',
      periode: input.periode ?? null,
      classeId: input.classeId ?? null,
      anneeScolaireId: input.anneeScolaireId ?? null,
    })
    .select(DOCUMENT_FIELDS)
    .single();
  if (error) throw error;
  return data as unknown as Document;
}

/**
 * Régénération: l'ancien document passe OBSOLETE. Jamais de suppression
 * (no-hard-delete). Le nouveau document est créé séparément par l'appelant
 * (genererBulletin / regenererBulletin).
 */
export async function marquerObsolete(id: string): Promise<void> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE');
  const supabase = createClient();
  const { error } = await supabase
    .from('document')
    .update({ statut: 'OBSOLETE' })
    .eq('id', id)
    .eq('etablissementId', ctx.etablissementId);
  if (error) throw error;
}

/**
 * Marque obsoletes tous les bulletins deja en vigueur d'un eleve pour une
 * classe et une periode.
 *
 * `marquerObsolete` ne traite qu'un document designe : elle convient a la
 * regeneration individuelle, ou l'on sait lequel on remplace. La generation
 * groupee, elle, ne designe rien — elle produit un nouveau bulletin pour toute
 * la classe — et empilait donc les documents en `GENERE`, jusqu'a cinq pour un
 * meme eleve.
 *
 * Porte sur (eleve, classe, periode) et non sur l'eleve seul : le bulletin du
 * 1er trimestre ne doit pas etre perime par la generation du 2eme.
 *
 * Renvoie le nombre de documents perimes, pour l'audit.
 */
export async function marquerBulletinsPrecedentsObsoletes(
  eleveId: string,
  classeId: string,
  periode: string,
  sauf: string,
): Promise<number> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE');
  const supabase = createClient();
  const { data, error } = await supabase
    .from('document')
    .update({ statut: 'OBSOLETE' })
    .eq('etablissementId', ctx.etablissementId)
    .eq('type', 'BULLETIN')
    .eq('objetId', eleveId)
    .eq('classeId', classeId)
    .eq('periode', periode)
    .eq('statut', 'GENERE')
    // Le document qui vient d'etre cree ne doit pas se perimer lui-meme.
    .neq('id', sauf)
    .select('id');
  if (error) throw error;
  return (data ?? []).length;
}

export async function getDocument(id: string): Promise<Document> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE', 'ENSEIGNANT');
  const supabase = createClient();
  const { data, error } = await supabase
    .from('document')
    .select(DOCUMENT_FIELDS)
    .eq('id', id)
    .eq('etablissementId', ctx.etablissementId)
    .single();
  if (error) throw error;
  return data as unknown as Document;
}

/** Historique des documents liés à un élève (bulletins essentiellement). */
export async function listDocumentsEleve(eleveId: string): Promise<Document[]> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'ENSEIGNANT');
  const supabase = createClient();
  const { data, error } = await supabase
    .from('document')
    .select(DOCUMENT_FIELDS)
    .eq('etablissementId', ctx.etablissementId)
    .eq('objetType', 'ELEVE')
    .eq('objetId', eleveId)
    .order('dateGeneration', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Document[];
}

/**
 * URL signée temporaire (5 min) vers le PDF d'un document, pour téléchargement
 * depuis l'UI. Le bucket `documents` est privé — passe par le service-role
 * (createAdminClient) après vérification du périmètre tenant via getDocument.
 */
export async function getUrlTelechargementDocument(id: string): Promise<string> {
  const document = await getDocument(id);
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from('documents')
    .createSignedUrl(document.cheminFichier, 300);
  if (error || !data) throw new Error(error?.message ?? "Échec de génération de l'URL de téléchargement");
  return data.signedUrl;
}

export async function listDocumentsParType(type: TypeDocument): Promise<Document[]> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE');
  const supabase = createClient();
  const { data, error } = await supabase
    .from('document')
    .select(DOCUMENT_FIELDS)
    .eq('etablissementId', ctx.etablissementId)
    .eq('type', type)
    .order('dateGeneration', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Document[];
}

export interface BulletinGenere {
  documentId: string;
  reference: string;
  dateGeneration: string;
  statut: StatutDocument;
  eleveId: string;
}

/**
 * Bulletins déjà édités pour une classe et une période.
 *
 * Les documents OBSOLETE sont retournés eux aussi : ce sont les versions
 * remplacées par une régénération, et l'écran doit pouvoir les distinguer
 * plutôt que de les faire disparaître. Le fichier reste en stockage,
 * l'opération est réversible — c'est la raison d'être du statut.
 *
 * `classeId` et `periode` viennent de l'appelant : ils sont comparés au tenant
 * par la clause `etablissementId`, jamais par la seule RLS.
 */
export async function listBulletinsClasse(
  classeId: string,
  periode: Periode,
): Promise<BulletinGenere[]> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE');
  const supabase = createClient();

  const { data, error } = await supabase
    .from('document')
    .select('id, reference, "dateGeneration", statut, "objetId"')
    .eq('etablissementId', ctx.etablissementId)
    .eq('type', 'BULLETIN')
    .eq('classeId', classeId)
    .eq('periode', periode)
    // `createdAt` en second critere : deux bulletins generes dans la meme
    // seconde — ce que fait la generation groupee d'une classe — auraient
    // sinon un ordre indetermine, et « le plus recent » designerait tantot
    // l'un tantot l'autre d'un affichage a l'autre.
    .order('dateGeneration', { ascending: false })
    .order('createdAt', { ascending: false });
  if (error) throw error;

  return (
    (data ?? []) as unknown as {
      id: string;
      reference: string;
      dateGeneration: string;
      statut: StatutDocument;
      objetId: string;
    }[]
  ).map((d) => ({
    documentId: d.id,
    reference: d.reference,
    dateGeneration: d.dateGeneration,
    statut: d.statut,
    eleveId: d.objetId,
  }));
}

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from './authorization';

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
}

const DOCUMENT_FIELDS =
  'id, "etablissementId", type, reference, "cheminFichier", "objetType", "objetId", "dateGeneration", "createdById", statut';

export interface EnregistrerDocumentInput {
  type: TypeDocument;
  reference: string;
  cheminFichier: string;
  objetType: string;
  objetId: string;
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

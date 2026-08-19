import { createClient } from '@/lib/supabase/server';
import { requireRole } from './authorization';
import { auditLog } from './audit';

export type StatutInscription = 'ACTIVE' | 'TERMINEE' | 'ANNULEE' | 'ABANDON';
export type DecisionFinAnnee = 'ADMIS' | 'REDOUBLANT' | 'DEPART';

export interface Inscription {
  id: string;
  etablissementId: string;
  eleveId: string;
  anneeScolaireId: string;
  classeId: string;
  dateInscription: string;
  statut: StatutInscription;
  decisionFinAnnee: DecisionFinAnnee | null;
  createdAt: string;
}

export interface InscriptionListFilters {
  classeId?: string;
  statut?: StatutInscription;
}

const INSCRIPTION_FIELDS =
  'id, "etablissementId", "eleveId", "anneeScolaireId", "classeId", "dateInscription", statut, "decisionFinAnnee", "createdAt"';

export async function listInscriptions(
  anneeScolaireId: string,
  filters: InscriptionListFilters = {},
): Promise<Inscription[]> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE');
  const supabase = createClient();
  let query = supabase
    .from('inscription')
    .select(INSCRIPTION_FIELDS)
    .eq('etablissementId', ctx.etablissementId)
    .eq('anneeScolaireId', anneeScolaireId);
  if (filters.classeId) query = query.eq('classeId', filters.classeId);
  if (filters.statut) query = query.eq('statut', filters.statut);
  const { data, error } = await query.order('dateInscription', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Inscription[];
}

export async function getInscriptionEleve(
  eleveId: string,
  anneeScolaireId: string,
): Promise<Inscription | null> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE');
  const supabase = createClient();
  const { data, error } = await supabase
    .from('inscription')
    .select(INSCRIPTION_FIELDS)
    .eq('etablissementId', ctx.etablissementId)
    .eq('eleveId', eleveId)
    .eq('anneeScolaireId', anneeScolaireId)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as Inscription | null;
}

export interface CreerInscriptionInput {
  eleveId: string;
  anneeScolaireId: string;
  classeId: string;
}

export interface CreerInscriptionResult {
  inscriptionId: string;
  factureId: string;
}

/**
 * Appelle fn_inscrire_eleve (RPC transactionnelle) : insère l'inscription et
 * génère la facture (squelette à 0 si aucun tarif pour la classe/année).
 * Traduit la violation unique(eleveId, anneeScolaireId) en message lisible.
 */
export async function creerInscriptionAvecFacture(
  input: CreerInscriptionInput,
): Promise<CreerInscriptionResult> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE');
  const supabase = createClient();

  const { data, error } = await supabase.rpc('fn_inscrire_eleve', {
    p_etablissement_id: ctx.etablissementId,
    p_eleve_id: input.eleveId,
    p_annee_scolaire_id: input.anneeScolaireId,
    p_classe_id: input.classeId,
  });
  if (error) {
    if (error.message.includes('déjà inscrit')) {
      throw new Error('Cet élève est déjà inscrit pour cette année scolaire.');
    }
    throw new Error(error.message);
  }

  const result = data as { inscriptionId: string; factureId: string };

  await auditLog({
    action: 'CREER_INSCRIPTION',
    module: 'eleves',
    objetType: 'Inscription',
    objetId: result.inscriptionId,
    nouvelleValeur: { eleveId: input.eleveId, classeId: input.classeId, factureId: result.factureId },
  });

  return result;
}

export async function annulerInscription(id: string): Promise<void> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE');
  const supabase = createClient();
  const { error } = await supabase
    .from('inscription')
    .update({ statut: 'ANNULEE' })
    .eq('id', id)
    .eq('etablissementId', ctx.etablissementId);
  if (error) throw error;

  await auditLog({
    action: 'ANNULER_INSCRIPTION',
    module: 'eleves',
    objetType: 'Inscription',
    objetId: id,
  });
}

/**
 * Ré-active une inscription précédemment annulée pour le même élève/année :
 * update de la ligne existante (jamais de nouvelle ligne, contrainte
 * unique(eleveId, anneeScolaireId) oblige) — repasse ACTIVE avec la nouvelle classe.
 */
export async function reinscrireEleve(id: string, classeId: string): Promise<void> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE');
  const supabase = createClient();
  const { error } = await supabase
    .from('inscription')
    .update({ statut: 'ACTIVE', classeId, decisionFinAnnee: null })
    .eq('id', id)
    .eq('etablissementId', ctx.etablissementId);
  if (error) throw error;

  await auditLog({
    action: 'REINSCRIRE_ELEVE',
    module: 'eleves',
    objetType: 'Inscription',
    objetId: id,
    nouvelleValeur: { classeId },
  });
}

export async function cloturerInscription(
  id: string,
  decisionFinAnnee: DecisionFinAnnee,
): Promise<void> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE');
  const supabase = createClient();
  const { error } = await supabase
    .from('inscription')
    .update({ statut: 'TERMINEE', decisionFinAnnee })
    .eq('id', id)
    .eq('etablissementId', ctx.etablissementId);
  if (error) throw error;

  await auditLog({
    action: 'CLOTURER_INSCRIPTION',
    module: 'eleves',
    objetType: 'Inscription',
    objetId: id,
    nouvelleValeur: { decisionFinAnnee },
  });
}

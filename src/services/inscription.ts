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

export interface ChangerClasseResult {
  inscriptionId: string;
  ancienneClasseId: string;
  nouvelleClasseId: string;
  factureId: string;
  ancienneFactureId: string | null;
  /** Combien de versements ont été rattachés à la nouvelle facture. */
  paiementsReportes: number;
  /** Ce que la famille a versé en trop, si la classe d'arrivée coûte moins cher. */
  surplus: number;
  montantTotal: number;
  totalPaye: number;
  solde: number;
  statut: string;
}

/**
 * Change la classe d'une inscription — et la facture avec elle.
 *
 * ## Elle remplace `reinscrireEleve`, qui est supprimée
 *
 * Celle-ci réactivait une inscription annulée avec une nouvelle classe, mais
 * **sans toucher à la facture** : un élève passé de la 6e à la 2nde aurait
 * gardé les frais de la 6e. Elle n'était appelée par aucun écran, donc le
 * défaut n'avait jamais tiré — c'est exactement la fonction morte qui finit par
 * être lue. Plutôt que de la corriger et de laisser deux chemins, elle part :
 * celle-ci réactive aussi, puisqu'elle repasse l'inscription en `ACTIVE`.
 *
 * ## Le geste que le produit n'avait pas
 *
 * `fn_inscrire_eleve` refuse dès qu'une ligne d'inscription existe, quel que
 * soit son statut — la contrainte `unique(eleveId, anneeScolaireId)` ne
 * permettrait de toute façon pas d'en créer une seconde. Une école qui s'était
 * trompée de classe n'avait donc aucune sortie : annuler ne rouvrait rien.
 *
 * Tout le travail est dans la RPC, en une transaction : facture annulée,
 * facture émise, versements reportés, statut recalculé par
 * `fn_recalculer_statut_facture`. Le faire ici, en quatre appels, laisserait
 * un élève sans facture si le troisième échouait.
 */
export async function changerClasseInscription(
  inscriptionId: string,
  classeId: string,
): Promise<ChangerClasseResult> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE');
  const supabase = createClient();

  const { data, error } = await supabase.rpc('fn_changer_classe_inscription', {
    p_etablissement_id: ctx.etablissementId,
    p_inscription_id: inscriptionId,
    p_classe_id: classeId,
  });
  if (error) throw new Error(error.message);

  const result = data as unknown as ChangerClasseResult;

  await auditLog({
    action: 'CHANGER_CLASSE_INSCRIPTION',
    module: 'eleves',
    objetType: 'Inscription',
    objetId: inscriptionId,
    ancienneValeur: {
      classeId: result.ancienneClasseId,
      factureId: result.ancienneFactureId,
    },
    nouvelleValeur: {
      classeId: result.nouvelleClasseId,
      factureId: result.factureId,
      paiementsReportes: result.paiementsReportes,
    },
  });

  return result;
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

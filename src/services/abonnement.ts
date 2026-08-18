import { createClient } from '@/lib/supabase/server';
import { requireRole } from './authorization';
import { auditLog } from './audit';

export type StatutAbonnement = 'ACTIF' | 'EXPIRE' | 'SUSPENDU';

export interface PlanAbonnement {
  id: string;
  nom: string;
  duree: string;
  prix: number;
}

export interface Abonnement {
  id: string;
  etablissementId: string;
  planId: string;
  dateDebut: string;
  dateFin: string;
  statut: StatutAbonnement;
  createdAt: string;
  etablissement: { nom: string };
  plan: { nom: string; prix: number; duree: string };
}

export interface CreateAbonnementInput {
  etablissementId: string;
  planId: string;
  dateDebut: string;
  dateFin: string;
}

export interface ValiderPaiementInput {
  abonnementId: string;
  montant: number;
  modePaiement: 'ESPECES' | 'CHEQUE' | 'VIREMENT' | 'MOBILE_MONEY' | 'AUTRE';
  reference?: string;
}

export async function listPlans(): Promise<PlanAbonnement[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('plan_abonnement')
    .select('id, nom, duree, prix')
    .order('prix');
  if (error) throw error;
  return data ?? [];
}

export async function listAbonnements(): Promise<Abonnement[]> {
  await requireRole();
  const supabase = createClient();
  const { data, error } = await supabase
    .from('abonnement_etablissement')
    .select(
      'id, "etablissementId", "planId", "dateDebut", "dateFin", statut, "createdAt", etablissement:etablissement(nom), plan:plan_abonnement(nom, prix, duree)',
    )
    .order('dateFin', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as Abonnement[];
}

export async function listAbonnementsParEtablissement(etablissementId: string): Promise<Abonnement[]> {
  await requireRole();
  const supabase = createClient();
  const { data, error } = await supabase
    .from('abonnement_etablissement')
    .select(
      'id, "etablissementId", "planId", "dateDebut", "dateFin", statut, "createdAt", etablissement:etablissement(nom), plan:plan_abonnement(nom, prix, duree)',
    )
    .eq('etablissementId', etablissementId)
    .order('dateFin', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Abonnement[];
}

export async function createAbonnement(input: CreateAbonnementInput): Promise<Abonnement> {
  await requireRole();
  const supabase = createClient();
  const { data, error } = await supabase
    .from('abonnement_etablissement')
    .insert({
      etablissementId: input.etablissementId,
      planId: input.planId,
      dateDebut: input.dateDebut,
      dateFin: input.dateFin,
    })
    .select(
      'id, "etablissementId", "planId", "dateDebut", "dateFin", statut, "createdAt", etablissement:etablissement(nom), plan:plan_abonnement(nom, prix, duree)',
    )
    .single();
  if (error) throw error;

  await auditLog({
    action: 'CREATE_ABONNEMENT',
    module: 'saas',
    objetType: 'AbonnementEtablissement',
    objetId: data.id,
    nouvelleValeur: { etablissementId: input.etablissementId, planId: input.planId },
  });

  return data as unknown as Abonnement;
}

/**
 * Records a manual payment (wire/mobile money confirmed off-platform) and
 * brings the subscription back to ACTIF. No online payment integration in v1.
 */
export async function validerPaiement(input: ValiderPaiementInput): Promise<void> {
  await requireRole();
  const supabase = createClient();

  const { error: paiementError } = await supabase.from('paiement_abonnement').insert({
    abonnementId: input.abonnementId,
    montant: input.montant,
    modePaiement: input.modePaiement,
    reference: input.reference || null,
  });
  if (paiementError) throw paiementError;

  const { error: statutError } = await supabase
    .from('abonnement_etablissement')
    .update({ statut: 'ACTIF' })
    .eq('id', input.abonnementId);
  if (statutError) throw statutError;

  await auditLog({
    action: 'VALIDER_PAIEMENT_ABONNEMENT',
    module: 'saas',
    objetType: 'PaiementAbonnement',
    objetId: input.abonnementId,
    nouvelleValeur: { montant: input.montant, modePaiement: input.modePaiement },
  });
}

export async function suspendreAbonnement(abonnementId: string): Promise<void> {
  await requireRole();
  const supabase = createClient();
  const { error } = await supabase
    .from('abonnement_etablissement')
    .update({ statut: 'SUSPENDU' })
    .eq('id', abonnementId);
  if (error) throw error;

  await auditLog({
    action: 'SUSPENDRE_ABONNEMENT',
    module: 'saas',
    objetType: 'AbonnementEtablissement',
    objetId: abonnementId,
  });
}

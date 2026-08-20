import { createClient } from '@/lib/supabase/server';
import { requireRole } from './authorization';
import { getTenantContext } from './tenant';
import { auditLog } from './audit';
import { evaluerAcces, ecritureAutorisee, type AccesAbonnement } from './abonnement-acces';
import { memoiserParRequete } from '@/lib/memo';

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

// ------------------------------------------------------------------
// Cycle de vie (Phase 7)
// ------------------------------------------------------------------

export interface PaiementAbonnement {
  id: string;
  abonnementId: string;
  montant: number;
  date: string;
  modePaiement: string;
  reference: string | null;
}

/**
 * Constate en base les abonnements dont l'échéance est passée. Appelée à
 * l'ouverture de la console plateforme : sans planificateur dans le MVP,
 * c'est le point de passage naturel. L'affichage ne dépend pas de ce
 * balayage — `statutEffectif()` déduit l'expiration de la date — mais le
 * stocker garde la base cohérente pour les exports et les rapports.
 */
export async function expirerAbonnementsEchus(): Promise<number> {
  await requireRole();
  const supabase = createClient();
  const { data, error } = await supabase.rpc('fn_expirer_abonnements');
  if (error) throw new Error(error.message);
  return (data as number) ?? 0;
}

/**
 * Ouvre la période suivante. Le nouvel abonnement naît SUSPENDU : l'accès
 * n'est rétabli qu'une fois le paiement constaté (`validerPaiement`), ce qui
 * évite d'offrir une période à une école qui n'a pas encore réglé.
 */
export async function renouvelerAbonnement(
  abonnementId: string,
  planId: string,
): Promise<{ abonnementId: string; dateDebut: string; dateFin: string }> {
  await requireRole();
  const supabase = createClient();

  const { data, error } = await supabase.rpc('fn_renouveler_abonnement', {
    p_abonnement_id: abonnementId,
    p_plan_id: planId,
  });
  if (error) throw new Error(error.message);

  const resultat = data as { abonnementId: string; dateDebut: string; dateFin: string };

  await auditLog({
    action: 'RENOUVELER_ABONNEMENT',
    module: 'saas',
    objetType: 'AbonnementEtablissement',
    objetId: resultat.abonnementId,
    ancienneValeur: { abonnementPrecedentId: abonnementId },
    nouvelleValeur: { planId, dateDebut: resultat.dateDebut, dateFin: resultat.dateFin },
  });

  return resultat;
}

/**
 * Lève une suspension. Refusé si l'échéance est déjà passée : réactiver un
 * abonnement échu rouvrirait l'accès sans contrepartie — il faut le
 * renouveler puis valider le paiement.
 */
export async function reactiverAbonnement(abonnementId: string): Promise<void> {
  await requireRole();
  const supabase = createClient();

  const { data: abonnement, error: lectureError } = await supabase
    .from('abonnement_etablissement')
    .select('id, statut, "dateFin"')
    .eq('id', abonnementId)
    .single();
  if (lectureError) throw lectureError;

  if (abonnement.statut !== 'SUSPENDU') {
    throw new Error("Cet abonnement n'est pas suspendu.");
  }
  if (new Date(abonnement.dateFin as string) < new Date()) {
    throw new Error(
      'Cet abonnement est échu : renouvelez-le et validez le paiement plutôt que de le réactiver.',
    );
  }

  const { error } = await supabase
    .from('abonnement_etablissement')
    .update({ statut: 'ACTIF' })
    .eq('id', abonnementId);
  if (error) throw error;

  await auditLog({
    action: 'REACTIVER_ABONNEMENT',
    module: 'saas',
    objetType: 'AbonnementEtablissement',
    objetId: abonnementId,
    ancienneValeur: { statut: 'SUSPENDU' },
    nouvelleValeur: { statut: 'ACTIF' },
  });
}

export async function listPaiementsAbonnement(
  abonnementId: string,
): Promise<PaiementAbonnement[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('paiement_abonnement')
    .select('id, "abonnementId", montant, date, "modePaiement", reference')
    .eq('abonnementId', abonnementId)
    .order('date', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as PaiementAbonnement[];
}

/**
 * Abonnement courant d'un établissement : le plus récent par date de fin.
 * Lisible par les rôles école (leur propre abonnement, via RLS) et par le
 * SUPER_ADMIN — d'où l'absence de `requireRole` restrictif ici : la policy
 * `abonnement_etablissement_read` fait déjà l'isolation, et cette lecture
 * alimente le bandeau affiché sur toutes les pages.
 */
export async function getAbonnementCourant(
  etablissementId: string,
): Promise<Abonnement | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('abonnement_etablissement')
    .select(
      'id, "etablissementId", "planId", "dateDebut", "dateFin", statut, "createdAt", etablissement:etablissement(nom), plan:plan_abonnement(nom, prix, duree)',
    )
    .eq('etablissementId', etablissementId)
    .order('dateFin', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as Abonnement) ?? null;
}

/**
 * Niveau d'accès de l'établissement courant, pour le bandeau et les gardes.
 * Le SUPER_ADMIN n'est jamais restreint : c'est lui qui gère les abonnements,
 * l'enfermer dehors rendrait la situation irréparable.
 */
export const getAccesAbonnementCourant = memoiserParRequete(async function getAccesAbonnementCourant(): Promise<AccesAbonnement> {
  const ctx = await getTenantContext();
  if (ctx.role === 'SUPER_ADMIN') {
    return { niveau: 'OK', statut: 'ACTIF', joursRestants: null, message: null };
  }
  const abonnement = await getAbonnementCourant(ctx.etablissementId);
  return evaluerAcces(
    abonnement ? { statut: abonnement.statut, dateFin: abonnement.dateFin } : null,
  );
});

/**
 * L'établissement courant a-t-il le droit d'écrire ?
 *
 * Le verrou dur est dans le middleware (il ne peut pas être contourné, même
 * par un appel direct de Server Action). Cet helper sert à l'UI : masquer un
 * bouton qui de toute façon renverrait 403 vaut mieux que le laisser cliquer
 * dans le vide — c'est exactement le genre d'échec silencieux qu'on cherche
 * à éviter.
 */
export async function peutEcrire(): Promise<boolean> {
  const acces = await getAccesAbonnementCourant();
  return ecritureAutorisee(acces.niveau);
}

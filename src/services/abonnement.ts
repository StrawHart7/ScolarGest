import { createClient } from '@/lib/supabase/server';
import { requireRole } from './authorization';
import { getTenantContext } from './tenant';
import { auditLog } from './audit';
import {
  evaluerAcces,
  ecritureAutorisee,
  debutProchainePeriode,
  finDePeriode,
  type AccesAbonnement,
  type EtatFacturation,
} from './abonnement-acces';
import { memoiserParRequete } from '@/lib/memo';

export type StatutAbonnement = 'ACTIF' | 'EXPIRE' | 'SUSPENDU';

export interface PlanAbonnement {
  id: string;
  nom: string;
  duree: string;
  prix: number;
  /**
   * `true` : le prix se multiplie par le nombre de cycles exploites.
   * `false` : forfait par etablissement (plan fondateur).
   *
   * Remonte jusqu'a l'ecran parce que la console demande un montant **saisi a
   * la main** : sans cette indication, un plan forfaitaire y serait multiplie
   * par deux pour un complexe college-lycee, et l'ecole paierait le double de
   * ce qui lui a ete promis.
   */
  parCycle: boolean;
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

export type ModePaiement = 'ESPECES' | 'CHEQUE' | 'VIREMENT' | 'MOBILE_MONEY' | 'AUTRE';

/**
 * Ouverture d'une période d'abonnement par la plateforme.
 *
 * Remplace l'ancien trio `createAbonnement` / `renouvelerAbonnement` /
 * `validerPaiement`. Le motif du regroupement : `renouvelerAbonnement` créait
 * la période en `SUSPENDU` en attendant le règlement, or `SUSPENDU` fermait
 * l'accès — préparer l'échéance suivante d'une école parfaitement à jour la
 * mettait donc dehors. La règle est désormais qu'**une ligne d'abonnement
 * n'existe que si elle est acquise**, exactement comme le fait déjà le webhook
 * FedaPay.
 *
 * `reglement` est facultatif : une période offerte (geste commercial, école
 * pilote) n'a pas de versement à consigner, mais son `montantTotal` vaut alors
 * zéro — c'est bien ce que l'école a payé, et le revenu de la console reste
 * juste.
 */
export interface OuvrirPeriodeInput {
  etablissementId: string;
  planId: string;
  nombreCycles: number;
  montantTotal: number;
  /** Défaut : enchaîne sur l'essai et la période en cours. */
  dateDebut?: string;
  reglement?: {
    montant: number;
    modePaiement: ModePaiement;
    reference?: string;
  } | null;
  /** Consigné dans le journal d'audit. Obligatoire pour une période offerte. */
  motif?: string;
}

/**
 * Catalogue des plans. Aucune donnée de tenant, mais une session reste exigée :
 * un catalogue tarifaire n'a pas à être lisible sans être connecté.
 */
export async function listPlans(): Promise<PlanAbonnement[]> {
  await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE', 'ENSEIGNANT');
  const supabase = createClient();
  const { data, error } = await supabase
    .from('plan_abonnement')
    .select('id, nom, duree, prix, "parCycle"')
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

/**
 * Ouvre une période d'abonnement acquise, et consigne son règlement.
 *
 * Le montant et le nombre de cycles sont **obligatoires**. L'ancienne
 * `createAbonnement` les omettait, et la base en porte la trace : deux
 * abonnements à `montantTotal` nul et un à 250 000 F qui ne correspond à
 * aucune ligne du catalogue. Le revenu de la console plateforme se lit sur
 * cette colonne — un NULL n'y est pas une donnée manquante, c'est un chiffre
 * d'affaires faux. La migration `0026` la passe en NOT NULL.
 *
 * La date de début, si elle n'est pas imposée, enchaîne sur l'essai et sur la
 * période en cours : voir `debutProchainePeriode`.
 */
export async function ouvrirPeriode(input: OuvrirPeriodeInput): Promise<Abonnement> {
  await requireRole();
  const supabase = createClient();

  if (input.nombreCycles < 1) {
    throw new Error('Le nombre de cycles facturés doit être au moins de 1.');
  }
  if (input.montantTotal < 0) {
    throw new Error('Le montant facturé ne peut pas être négatif.');
  }
  if (input.montantTotal === 0 && !input.motif?.trim()) {
    // Une période gratuite est un geste commercial : sans motif, personne ne
    // saura dans six mois pourquoi cette école n'a rien payé.
    throw new Error('Une période offerte exige un motif.');
  }

  const { data: plan, error: erreurPlan } = await supabase
    .from('plan_abonnement')
    .select('duree')
    .eq('id', input.planId)
    .single();
  if (erreurPlan) throw erreurPlan;

  let debut: Date;
  if (input.dateDebut) {
    debut = new Date(input.dateDebut);
  } else {
    const [{ data: courant }, { data: etab }] = await Promise.all([
      supabase
        .from('abonnement_etablissement')
        .select('"dateFin"')
        .eq('etablissementId', input.etablissementId)
        .order('dateFin', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('etablissement')
        .select('"essaiFinLe"')
        .eq('id', input.etablissementId)
        .maybeSingle(),
    ]);
    debut = debutProchainePeriode(
      (etab as { essaiFinLe: string | null } | null)?.essaiFinLe ?? null,
      (courant as { dateFin: string } | null)?.dateFin ?? null,
    );
  }
  const fin = finDePeriode(debut, (plan as { duree: 'MOIS' | 'AN' }).duree);

  const { data, error } = await supabase
    .from('abonnement_etablissement')
    .insert({
      etablissementId: input.etablissementId,
      planId: input.planId,
      dateDebut: debut.toISOString(),
      dateFin: fin.toISOString(),
      statut: 'ACTIF',
      nombreCycles: input.nombreCycles,
      montantTotal: input.montantTotal,
    })
    .select(
      'id, "etablissementId", "planId", "dateDebut", "dateFin", statut, "createdAt", etablissement:etablissement(nom), plan:plan_abonnement(nom, prix, duree)',
    )
    .single();
  if (error) throw error;

  const abonnementId = (data as { id: string }).id;

  if (input.reglement) {
    const { error: erreurReglement } = await supabase.from('paiement_abonnement').insert({
      abonnementId,
      montant: input.reglement.montant,
      modePaiement: input.reglement.modePaiement,
      reference: input.reglement.reference || null,
    });
    if (erreurReglement) throw erreurReglement;
  }

  await auditLog({
    action: input.montantTotal === 0 ? 'OFFRIR_PERIODE' : 'OUVRIR_PERIODE_ABONNEMENT',
    module: 'saas',
    objetType: 'AbonnementEtablissement',
    objetId: abonnementId,
    nouvelleValeur: {
      etablissementId: input.etablissementId,
      planId: input.planId,
      nombreCycles: input.nombreCycles,
      montantTotal: input.montantTotal,
      dateDebut: debut.toISOString(),
      dateFin: fin.toISOString(),
      motif: input.motif ?? null,
      reglement: input.reglement?.modePaiement ?? null,
    },
  });

  return data as unknown as Abonnement;
}

/**
 * Enregistre un versement sur une période déjà ouverte.
 *
 * Ne touche plus au statut : une période n'existe que si elle est acquise, un
 * versement ne « réactive » donc rien. Sert aux règlements échelonnés et aux
 * régularisations.
 */
export async function enregistrerReglement(input: {
  abonnementId: string;
  montant: number;
  modePaiement: ModePaiement;
  reference?: string;
}): Promise<void> {
  await requireRole();
  const supabase = createClient();

  const { error } = await supabase.from('paiement_abonnement').insert({
    abonnementId: input.abonnementId,
    montant: input.montant,
    modePaiement: input.modePaiement,
    reference: input.reference || null,
  });
  if (error) throw error;

  await auditLog({
    action: 'VALIDER_PAIEMENT_ABONNEMENT',
    module: 'saas',
    objetType: 'PaiementAbonnement',
    objetId: input.abonnementId,
    nouvelleValeur: { montant: input.montant, modePaiement: input.modePaiement },
  });
}

// ------------------------------------------------------------------
// Suspension : une décision qui vise l'école, pas une période
// ------------------------------------------------------------------

/**
 * Suspend un établissement, motif obligatoire.
 *
 * Le motif n'est pas une formalité de journal : il est **affiché au Directeur
 * et à la Secrétaire**. Une école coupée sans explication appelle le support
 * pour demander pourquoi ; celle qui lit le motif appelle pour le résoudre.
 * La contrainte `etablissement_motif_suspension_requis` (migration `0026`) le
 * rend impossible à omettre, y compris par un appel direct à PostgREST.
 *
 * La suspension porte sur l'établissement depuis `0026`. Sur l'abonnement,
 * elle s'effaçait toute seule : l'abonnement courant étant celui dont la
 * `dateFin` est la plus lointaine, une nouvelle période rendait l'école
 * active. Une sanction qu'un paiement suffit à lever n'en est pas une.
 */
export async function suspendreEtablissement(
  etablissementId: string,
  motif: string,
): Promise<void> {
  await requireRole();
  const supabase = createClient();

  const propre = motif.trim();
  if (propre.length < 10) {
    throw new Error('Le motif de suspension doit être explicite (10 caractères minimum).');
  }

  const { error } = await supabase
    .from('etablissement')
    .update({ suspenduLe: new Date().toISOString(), motifSuspension: propre })
    .eq('id', etablissementId);
  if (error) throw error;

  await auditLog({
    action: 'SUSPENDRE_ETABLISSEMENT',
    module: 'saas',
    objetType: 'Etablissement',
    objetId: etablissementId,
    nouvelleValeur: { motif: propre },
  });
}

/** Lève une suspension. L'abonnement retrouve son effet naturel. */
export async function leverSuspension(etablissementId: string): Promise<void> {
  await requireRole();
  const supabase = createClient();

  const { data: avant } = await supabase
    .from('etablissement')
    .select('"motifSuspension"')
    .eq('id', etablissementId)
    .maybeSingle();

  const { error } = await supabase
    .from('etablissement')
    .update({ suspenduLe: null, motifSuspension: null })
    .eq('id', etablissementId);
  if (error) throw error;

  await auditLog({
    action: 'LEVER_SUSPENSION',
    module: 'saas',
    objetType: 'Etablissement',
    objetId: etablissementId,
    ancienneValeur: {
      motif: (avant as { motifSuspension: string | null } | null)?.motifSuspension ?? null,
    },
  });
}

/**
 * Prolonge l'essai gratuit d'un établissement.
 *
 * Geste commercial courant — une école qui découvre le produit en pleine
 * rentrée n'a matériellement pas le temps de l'évaluer en trente jours. Le
 * trigger `fn_proteger_facturation` refuse cette écriture à tout le monde sauf
 * au SUPER_ADMIN et à la clé de service : l'école ne peut pas se prolonger
 * elle-même.
 *
 * Le motif est consigné, pas affiché : une prolongation est une bonne
 * nouvelle, elle n'a pas à être justifiée auprès de son bénéficiaire.
 */
export async function prolongerEssai(
  etablissementId: string,
  jours: number,
  motif: string,
): Promise<string> {
  await requireRole();
  if (!Number.isInteger(jours) || jours < 1 || jours > 180) {
    throw new Error('La prolongation doit être comprise entre 1 et 180 jours.');
  }
  if (motif.trim().length < 5) {
    throw new Error('Indiquez le motif de la prolongation.');
  }

  const supabase = createClient();
  const { data: etab, error: erreurLecture } = await supabase
    .from('etablissement')
    .select('"essaiDebuteLe", "essaiFinLe"')
    .eq('id', etablissementId)
    .single();
  if (erreurLecture) throw erreurLecture;

  const ligne = etab as { essaiDebuteLe: string | null; essaiFinLe: string | null };
  if (!ligne.essaiDebuteLe) {
    throw new Error("L'essai de cet établissement n'a pas encore démarré : rien à prolonger.");
  }

  // Repart d'aujourd'hui si l'essai est déjà échu : prolonger de sept jours un
  // essai terminé depuis un mois ne rouvrirait rien.
  const base = new Date(ligne.essaiFinLe ?? Date.now());
  const depart = base.getTime() > Date.now() ? base : new Date();
  const nouvelleFin = new Date(depart.getTime() + jours * 24 * 60 * 60 * 1000);

  const { error } = await supabase
    .from('etablissement')
    .update({ essaiFinLe: nouvelleFin.toISOString() })
    .eq('id', etablissementId);
  if (error) throw error;

  await auditLog({
    action: 'PROLONGER_ESSAI',
    module: 'saas',
    objetType: 'Etablissement',
    objetId: etablissementId,
    ancienneValeur: { essaiFinLe: ligne.essaiFinLe },
    nouvelleValeur: { essaiFinLe: nouvelleFin.toISOString(), jours, motif: motif.trim() },
  });

  return nouvelleFin.toISOString();
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
 * Versements d'un abonnement.
 *
 * La policy `paiement_abonnement_read` isole déjà par jointure sur
 * l'établissement, mais s'en remettre à elle seule contrevient à la règle de
 * défense en profondeur du projet : si la policy est un jour assouplie, plus
 * rien ne rattrape. La garde de rôle est donc explicite, et le SUPER_ADMIN
 * passe par le court-circuit de `requireRole`.
 */
export async function listPaiementsAbonnement(
  abonnementId: string,
): Promise<PaiementAbonnement[]> {
  await requireRole('DIRECTEUR');
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
 *
 * Lisible par les rôles école pour **leur** établissement, et par le
 * SUPER_ADMIN pour n'importe lequel. La policy RLS le garantit déjà, mais
 * `etablissementId` arrive ici depuis l'appelant : on compare donc
 * explicitement au contexte, comme l'impose la règle de défense en profondeur
 * du projet. Sans cette comparaison, la sécurité de la lecture reposerait
 * entièrement sur une policy, sans filet applicatif.
 */
export async function getAbonnementCourant(
  etablissementId: string,
): Promise<Abonnement | null> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE', 'ENSEIGNANT');
  if (ctx.role !== 'SUPER_ADMIN' && etablissementId !== ctx.etablissementId) {
    throw new Error("Accès refusé : abonnement d'un autre établissement.");
  }
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
 * Facturation portée par l'établissement lui-même : fenêtre d'essai et
 * suspension.
 *
 * Une seule lecture pour les trois colonnes. Elles se consultent toujours
 * ensemble — `evaluerAcces` en a besoin simultanément — et trois allers-retours
 * là où un suffit se paient sur chaque navigation.
 *
 * L'essai est porté par `etablissement` et non par `abonnement_etablissement` :
 * un essai n'est pas une vente, et `planId` y est NOT NULL (migration `0015`).
 * La suspension l'a rejoint en `0026`, pour ne pas s'effacer au renouvellement.
 */
export interface EtatEtablissement {
  essaiDebuteLe: string | null;
  essaiFinLe: string | null;
  suspension: { le: string; motif: string } | null;
}

export async function getEtatEtablissement(
  etablissementId: string,
): Promise<EtatEtablissement> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE', 'ENSEIGNANT');
  if (ctx.role !== 'SUPER_ADMIN' && etablissementId !== ctx.etablissementId) {
    throw new Error('Accès refusé : établissement différent du contexte.');
  }
  const supabase = createClient();
  const { data, error } = await supabase
    .from('etablissement')
    .select('"essaiDebuteLe", "essaiFinLe", "suspenduLe", "motifSuspension"')
    .eq('id', etablissementId)
    .maybeSingle();
  if (error) throw error;

  const ligne = data as {
    essaiDebuteLe: string | null;
    essaiFinLe: string | null;
    suspenduLe: string | null;
    motifSuspension: string | null;
  } | null;

  return {
    essaiDebuteLe: ligne?.essaiDebuteLe ?? null,
    essaiFinLe: ligne?.essaiFinLe ?? null,
    // Le motif est obligatoire en base dès que `suspenduLe` est posé : le repli
    // ne couvre qu'une ligne écrite avant la contrainte.
    suspension: ligne?.suspenduLe
      ? { le: ligne.suspenduLe, motif: ligne.motifSuspension ?? 'Motif non précisé.' }
      : null,
  };
}

/**
 * État de facturation complet d'un établissement, prêt pour `evaluerAcces`.
 */
export async function getEtatFacturation(etablissementId: string): Promise<EtatFacturation> {
  const [abonnement, etat] = await Promise.all([
    getAbonnementCourant(etablissementId),
    getEtatEtablissement(etablissementId),
  ]);
  return {
    abonnement: abonnement ? { statut: abonnement.statut, dateFin: abonnement.dateFin } : null,
    essaiFinLe: etat.essaiFinLe,
    essaiDebuteLe: etat.essaiDebuteLe,
    suspension: etat.suspension,
  };
}

/**
 * Démarre l'essai gratuit s'il ne l'est pas déjà.
 *
 * Appelée à la définition du PIN de démarrage — la première écriture réelle du
 * Directeur, donc son premier contact utile avec le produit. Décompter depuis
 * la création de l'établissement par le SUPER_ADMIN punirait une école
 * provisionnée trois semaines avant la rentrée.
 *
 * Idempotente par le `is null` : rappeler cette fonction ne prolonge rien. Les
 * dates elles-mêmes sont imposées par le trigger `fn_proteger_dates_essai`
 * (migration `0015`) — la valeur envoyée ici n'est qu'un déclencheur, pas une
 * donnée de confiance, puisque la RLS laisse le Directeur écrire sur sa propre
 * ligne d'établissement.
 *
 * Ne lève jamais : un essai qui ne démarre pas ne doit pas faire échouer
 * l'étape de configuration qui l'a déclenché. L'établissement resterait
 * simplement sans fenêtre d'essai, cas rattrapable par la console plateforme.
 */
export async function demarrerEssaiSiNecessaire(): Promise<void> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE');
  if (!ctx.etablissementId) return;
  const supabase = createClient();
  const { data, error } = await supabase
    .from('etablissement')
    .update({ essaiDebuteLe: new Date().toISOString() })
    .eq('id', ctx.etablissementId)
    .is('essaiDebuteLe', null)
    .select('id');
  if (error) return;
  if ((data ?? []).length === 0) return;

  await auditLog({
    action: 'DEMARRER_ESSAI',
    module: 'saas',
    objetType: 'Etablissement',
    objetId: ctx.etablissementId,
  });
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
  return evaluerAcces(await getEtatFacturation(ctx.etablissementId));
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

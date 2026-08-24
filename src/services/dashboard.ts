import { createClient } from '@/lib/supabase/server';
import { requireRole } from './authorization';
import { getTenantContext } from './tenant';
import { calculerSolde, totalPaye } from './facture';
import { listMesAffectations } from './affectation';

/**
 * Agrégats du tableau de bord (doc 09 §11) et flux d'activité du Directeur
 * (doc 09 §12). Chaque rôle a sa propre fonction plutôt qu'un objet géant
 * filtré à l'affichage : un Comptable ne doit pas déclencher les requêtes
 * académiques, et un Enseignant ne doit jamais faire partir une requête
 * financière — le périmètre se joue ici, pas dans le JSX.
 */

export interface StatsEleves {
  total: number;
  actifs: number;
  nouveauxCeMois: number;
}

export interface StatsClasses {
  nombre: number;
  effectifTotal: number;
  capaciteTotale: number;
}

export interface StatsFinance {
  attendu: number;
  encaisse: number;
  impaye: number;
  facturesSoldees: number;
  facturesTotal: number;
}

export interface StatsAcademique {
  evaluations: number;
  notesEnAttente: number;
  bulletinsGeneres: number;
}

export interface DashboardDirecteur {
  eleves: StatsEleves;
  classes: StatsClasses;
  finance: StatsFinance;
  academique: StatsAcademique;
  enseignantsActifs: number;
}

export interface EvenementActivite {
  id: string;
  action: string;
  module: string;
  date: string;
  libelle: string;
}

// ------------------------------------------------------------------
// Blocs réutilisables
// ------------------------------------------------------------------

async function statsEleves(etablissementId: string, anneeScolaireId: string): Promise<StatsEleves> {
  const supabase = createClient();

  const { data: inscriptions, error } = await supabase
    .from('inscription')
    .select('"eleveId", statut, "dateInscription"')
    .eq('etablissementId', etablissementId)
    .eq('anneeScolaireId', anneeScolaireId);
  if (error) throw error;

  const rows = (inscriptions ?? []) as unknown as {
    eleveId: string;
    statut: string;
    dateInscription: string;
  }[];

  const debutMois = new Date();
  debutMois.setDate(1);
  debutMois.setHours(0, 0, 0, 0);

  return {
    total: rows.length,
    actifs: rows.filter((i) => i.statut === 'ACTIVE').length,
    nouveauxCeMois: rows.filter((i) => new Date(i.dateInscription) >= debutMois).length,
  };
}

async function statsClasses(
  etablissementId: string,
  anneeScolaireId: string,
): Promise<StatsClasses> {
  const supabase = createClient();

  const { data: classes, error } = await supabase
    .from('classe')
    .select('id, capacite')
    .eq('etablissementId', etablissementId)
    .eq('anneeScolaireId', anneeScolaireId);
  if (error) throw error;

  const { count: effectif } = await supabase
    .from('inscription')
    .select('*', { count: 'exact', head: true })
    .eq('etablissementId', etablissementId)
    .eq('anneeScolaireId', anneeScolaireId)
    .eq('statut', 'ACTIVE');

  const rows = (classes ?? []) as { id: string; capacite: number | null }[];
  return {
    nombre: rows.length,
    effectifTotal: effectif ?? 0,
    capaciteTotale: rows.reduce((s, c) => s + (c.capacite ?? 0), 0),
  };
}

async function statsFinance(
  etablissementId: string,
  anneeScolaireId: string,
): Promise<StatsFinance> {
  const supabase = createClient();

  const { data: factures, error } = await supabase
    .from('facture_eleve')
    .select('id, "montantTotal", statut')
    .eq('etablissementId', etablissementId)
    .eq('anneeScolaireId', anneeScolaireId)
    .neq('statut', 'ANNULE');
  if (error) throw error;

  const rows = (factures ?? []) as unknown as {
    id: string;
    montantTotal: number;
    statut: string;
  }[];
  if (rows.length === 0) {
    return { attendu: 0, encaisse: 0, impaye: 0, facturesSoldees: 0, facturesTotal: 0 };
  }

  const { data: paiements } = await supabase
    .from('paiement')
    .select('"factureId", montant, statut')
    .in(
      'factureId',
      rows.map((f) => f.id),
    );

  const parFacture = new Map<string, { montant: number; statut: 'PAYE' | 'ANNULE' }[]>();
  for (const p of (paiements ?? []) as unknown as {
    factureId: string;
    montant: number;
    statut: 'PAYE' | 'ANNULE';
  }[]) {
    if (!parFacture.has(p.factureId)) parFacture.set(p.factureId, []);
    parFacture.get(p.factureId)!.push(p);
  }

  let attendu = 0;
  let encaisse = 0;
  let impaye = 0;
  for (const facture of rows) {
    const paiementsFacture = parFacture.get(facture.id) ?? [];
    attendu += Number(facture.montantTotal);
    encaisse += totalPaye(paiementsFacture);
    impaye += calculerSolde(facture.montantTotal, paiementsFacture);
  }

  return {
    attendu,
    encaisse,
    impaye,
    facturesSoldees: rows.filter((f) => f.statut === 'PAYE').length,
    facturesTotal: rows.length,
  };
}

async function statsAcademique(
  etablissementId: string,
  anneeScolaireId: string,
): Promise<StatsAcademique> {
  const supabase = createClient();

  const { data: classes } = await supabase
    .from('classe')
    .select('id')
    .eq('etablissementId', etablissementId)
    .eq('anneeScolaireId', anneeScolaireId);
  const classeIds = ((classes ?? []) as { id: string }[]).map((c) => c.id);

  let evaluations = 0;
  let notesEnAttente = 0;
  if (classeIds.length > 0) {
    const { data: evals, count } = await supabase
      .from('evaluation')
      .select('id', { count: 'exact' })
      .in('classeId', classeIds);
    evaluations = count ?? 0;

    const evaluationIds = ((evals ?? []) as { id: string }[]).map((e) => e.id);
    if (evaluationIds.length > 0) {
      // « Notes à approuver » couvre les deux files que traite la Secrétaire :
      // les soumissions initiales (SOUMISE) et les demandes de correction
      // (EN_ATTENTE) sur des notes déjà validées.
      const { count: enAttente } = await supabase
        .from('note')
        .select('*', { count: 'exact', head: true })
        .in('evaluationId', evaluationIds)
        .in('statut', ['SOUMISE', 'EN_ATTENTE']);
      notesEnAttente = enAttente ?? 0;
    }
  }

  const { count: bulletins } = await supabase
    .from('document')
    .select('*', { count: 'exact', head: true })
    .eq('etablissementId', etablissementId)
    .eq('type', 'BULLETIN')
    .eq('statut', 'GENERE');

  return { evaluations, notesEnAttente, bulletinsGeneres: bulletins ?? 0 };
}

// ------------------------------------------------------------------
// Tableaux de bord par rôle
// ------------------------------------------------------------------

export async function getDashboardDirecteur(
  anneeScolaireId: string,
): Promise<DashboardDirecteur> {
  const ctx = await requireRole('DIRECTEUR');
  const supabase = createClient();

  const [eleves, classes, finance, academique] = await Promise.all([
    statsEleves(ctx.etablissementId, anneeScolaireId),
    statsClasses(ctx.etablissementId, anneeScolaireId),
    statsFinance(ctx.etablissementId, anneeScolaireId),
    statsAcademique(ctx.etablissementId, anneeScolaireId),
  ]);

  const { count: enseignantsActifs } = await supabase
    .from('enseignant')
    .select('*', { count: 'exact', head: true })
    .eq('etablissementId', ctx.etablissementId)
    .eq('statut', 'ACTIF');

  return { eleves, classes, finance, academique, enseignantsActifs: enseignantsActifs ?? 0 };
}

export async function getDashboardComptable(anneeScolaireId: string): Promise<StatsFinance> {
  const ctx = await requireRole('COMPTABLE');
  return statsFinance(ctx.etablissementId, anneeScolaireId);
}

export interface DashboardSecretaire {
  eleves: StatsEleves;
  classes: StatsClasses;
  bulletinsGeneres: number;
  notesEnAttente: number;
}

export async function getDashboardSecretaire(
  anneeScolaireId: string,
): Promise<DashboardSecretaire> {
  const ctx = await requireRole('SECRETAIRE');
  const [eleves, classes, academique] = await Promise.all([
    statsEleves(ctx.etablissementId, anneeScolaireId),
    statsClasses(ctx.etablissementId, anneeScolaireId),
    statsAcademique(ctx.etablissementId, anneeScolaireId),
  ]);
  return {
    eleves,
    classes,
    bulletinsGeneres: academique.bulletinsGeneres,
    notesEnAttente: academique.notesEnAttente,
  };
}

export interface DashboardEnseignant {
  classes: number;
  matieres: number;
  evaluations: number;
  notesBrouillon: number;
}

export async function getDashboardEnseignant(
  anneeScolaireId: string,
): Promise<DashboardEnseignant> {
  await requireRole('ENSEIGNANT');
  const supabase = createClient();

  const affectations = await listMesAffectations(anneeScolaireId);
  const classeIds = [...new Set(affectations.map((a) => a.classeId))];
  const matiereIds = [...new Set(affectations.map((a) => a.matiereId))];

  if (classeIds.length === 0) {
    return { classes: 0, matieres: 0, evaluations: 0, notesBrouillon: 0 };
  }

  // Seules les évaluations des couples classe×matière affectés à cet
  // enseignant sont comptées : une classe partagée entre plusieurs
  // professeurs ne doit pas gonfler le compteur de chacun.
  const { data: evaluations } = await supabase
    .from('evaluation')
    .select('id, "classeId", "matiereId"')
    .eq('anneeScolaireId', anneeScolaireId)
    .in('classeId', classeIds)
    .in('matiereId', matiereIds);

  const couples = new Set(affectations.map((a) => `${a.classeId}|${a.matiereId}`));
  const siennes = ((evaluations ?? []) as { id: string; classeId: string; matiereId: string }[])
    .filter((e) => couples.has(`${e.classeId}|${e.matiereId}`))
    .map((e) => e.id);

  let notesBrouillon = 0;
  if (siennes.length > 0) {
    const { count } = await supabase
      .from('note')
      .select('*', { count: 'exact', head: true })
      .in('evaluationId', siennes)
      .eq('statut', 'BROUILLON');
    notesBrouillon = count ?? 0;
  }

  return {
    classes: classeIds.length,
    matieres: matiereIds.length,
    evaluations: siennes.length,
    notesBrouillon,
  };
}

// ------------------------------------------------------------------
// Flux d'activité (Directeur) — informatif uniquement, doc 09 §12
// ------------------------------------------------------------------

const LIBELLES_ACTION: Record<string, string> = {
  GENERER_BULLETIN: 'Bulletin généré',
  REGENERER_BULLETIN: 'Bulletin régénéré',
  GENERER_RECU: 'Reçu de paiement généré',
  ENREGISTRER_PAIEMENT: 'Versement encaissé',
  ANNULER_PAIEMENT: 'Versement annulé',
  MODIFIER_LIGNES_FACTURE: 'Lignes de facture ajustées',
  ANNULER_FACTURE: 'Facture annulée',
  CREER_TARIF: 'Tarif créé',
  CREATE_TARIF: 'Tarif créé',
  CREATE_TYPE_FRAIS: 'Type de frais créé',
  INSCRIRE_ELEVE: 'Élève inscrit',
  CREATE_ELEVE: 'Élève créé',
  IMPORT_ELEVES: 'Import d’élèves',
  IMPORT_PAIEMENTS: 'Import de versements',
  APPROUVER_NOTE: 'Modification de note approuvée',
  REJETER_NOTE: 'Modification de note rejetée',
  EXPORTER_RAPPORT: 'Rapport exporté',
};

/**
 * Dernières actions sensibles de l'établissement. Purement informatif : le
 * Directeur ne valide rien depuis ce flux (doc 09 §12).
 */
export async function getFluxActivite(limite = 12): Promise<EvenementActivite[]> {
  const ctx = await requireRole('DIRECTEUR');
  const supabase = createClient();

  const { data, error } = await supabase
    .from('audit_log')
    .select('id, action, module, date')
    .eq('etablissementId', ctx.etablissementId)
    .in('action', Object.keys(LIBELLES_ACTION))
    .order('date', { ascending: false })
    .limit(limite);
  if (error) throw error;

  return ((data ?? []) as { id: string; action: string; module: string; date: string }[]).map(
    (e) => ({
      id: e.id,
      action: e.action,
      module: e.module,
      date: e.date,
      libelle: LIBELLES_ACTION[e.action] ?? e.action,
    }),
  );
}

/** Année scolaire à afficher par défaut sur le tableau de bord. */
export async function getAnneeCourante(): Promise<{ id: string; libelle: string } | null> {
  const ctx = await getTenantContext();
  const supabase = createClient();
  const { data } = await supabase
    .from('annee_scolaire')
    .select('id, libelle, statut')
    .eq('etablissementId', ctx.etablissementId)
    .order('dateDebut', { ascending: false });

  const annees = (data ?? []) as { id: string; libelle: string; statut: string }[];
  return annees.find((a) => a.statut === 'ACTIVE') ?? annees[0] ?? null;
}

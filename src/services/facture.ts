import { createClient } from '@/lib/supabase/server';
import { requireRole } from './authorization';
import { auditLog } from './audit';

export type StatutFacture = 'PAYE' | 'PARTIEL' | 'IMPAYE' | 'ANNULE';
export type StatutPaiement = 'PAYE' | 'PARTIEL' | 'IMPAYE' | 'ANNULE';

export interface LigneFacture {
  id: string;
  factureId: string;
  typeFraisId: string;
  designation: string;
  montant: number;
}

export interface PaiementFacture {
  id: string;
  factureId: string;
  montant: number;
  datePaiement: string;
  modePaiement: string;
  reference: string | null;
  statut: StatutPaiement;
}

export interface FactureEleve {
  id: string;
  etablissementId: string;
  eleveId: string;
  anneeScolaireId: string;
  montantTotal: number;
  statut: StatutFacture;
  dateCreation: string;
  lignes: LigneFacture[];
}

export interface FactureDetail extends FactureEleve {
  paiements: PaiementFacture[];
  totalPaye: number;
  solde: number;
  /** Les lignes ne sont ajustables que tant qu'aucun versement n'est encaissé. */
  lignesModifiables: boolean;
  eleve: { id: string; nom: string; prenoms: string; matricule: string; statut: string };
  classeNom: string | null;
  anneeLibelle: string | null;
}

/** Ligne du suivi des paiements — une facture par élève, avec son reste dû. */
export interface SuiviPaiementLigne {
  factureId: string;
  eleveId: string;
  matricule: string;
  nom: string;
  prenoms: string;
  classeId: string | null;
  classeNom: string | null;
  montantTotal: number;
  totalPaye: number;
  solde: number;
  statut: StatutFacture;
}

const FACTURE_FIELDS =
  'id, "etablissementId", "eleveId", "anneeScolaireId", "montantTotal", statut, "dateCreation"';
const LIGNE_FIELDS = 'id, "factureId", "typeFraisId", designation, montant';
const PAIEMENT_FIELDS =
  'id, "factureId", montant, "datePaiement", "modePaiement", reference, statut';

// ------------------------------------------------------------------
// Calculs purs — testés unitairement avant toute UI (principe #7 du PLAN)
// ------------------------------------------------------------------

/** Somme des versements réellement encaissés : un paiement ANNULE ne compte pas. */
export function totalPaye(paiements: Pick<PaiementFacture, 'montant' | 'statut'>[]): number {
  return paiements
    .filter((p) => p.statut !== 'ANNULE')
    .reduce((somme, p) => somme + Number(p.montant), 0);
}

/**
 * Solde restant dû (doc 08 §13). Borné à 0 : un trop-perçu n'existe pas au
 * MVP (la RPC refuse un versement supérieur au reste dû), et afficher un
 * solde négatif induirait en erreur si une correction manuelle en créait un.
 */
export function calculerSolde(
  montantTotal: number,
  paiements: Pick<PaiementFacture, 'montant' | 'statut'>[],
): number {
  return Math.max(Number(montantTotal) - totalPaye(paiements), 0);
}

/**
 * Statut informatif d'une facture (doc 08 §16) — aucun blocage système n'en
 * découle. Miroir exact de `fn_recalculer_statut_facture` côté base : la base
 * fait foi, cette fonction sert à l'affichage et aux tests.
 */
export function statutFacture(
  montantTotal: number,
  paiements: Pick<PaiementFacture, 'montant' | 'statut'>[],
  annulee = false,
): StatutFacture {
  if (annulee) return 'ANNULE';
  const paye = totalPaye(paiements);
  if (paye <= 0) return 'IMPAYE';
  if (paye >= Number(montantTotal)) return 'PAYE';
  return 'PARTIEL';
}

/**
 * Solde d'une facture dont on ne connaît que le montant total.
 * Conservée pour la fiche élève (Phase 2), qui n'affiche pas les versements.
 * @deprecated Préférer `calculerSolde(montantTotal, paiements)`.
 */
export function calculerSoldeFacture(facture: Pick<FactureEleve, 'montantTotal'>): number {
  return facture.montantTotal;
}

// ------------------------------------------------------------------
// Lecture
// ------------------------------------------------------------------

export async function getFacturesEleve(eleveId: string): Promise<FactureEleve[]> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE');
  const supabase = createClient();
  const { data: factures, error } = await supabase
    .from('facture_eleve')
    .select(FACTURE_FIELDS)
    .eq('etablissementId', ctx.etablissementId)
    .eq('eleveId', eleveId)
    .order('dateCreation', { ascending: false });
  if (error) throw error;

  const result: FactureEleve[] = [];
  for (const f of factures ?? []) {
    const { data: lignes, error: lignesError } = await supabase
      .from('ligne_facture')
      .select(LIGNE_FIELDS)
      .eq('factureId', f.id);
    if (lignesError) throw lignesError;
    result.push({ ...(f as unknown as Omit<FactureEleve, 'lignes'>), lignes: lignes ?? [] });
  }
  return result;
}

/** Facture complète : lignes, versements, solde et contexte élève/classe. */
export async function getFactureDetail(factureId: string): Promise<FactureDetail> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE');
  const supabase = createClient();

  const { data: facture, error } = await supabase
    .from('facture_eleve')
    .select(FACTURE_FIELDS)
    .eq('id', factureId)
    .eq('etablissementId', ctx.etablissementId)
    .single();
  if (error) throw error;
  const f = facture as unknown as Omit<FactureEleve, 'lignes'>;

  const { data: lignes, error: lignesError } = await supabase
    .from('ligne_facture')
    .select(LIGNE_FIELDS)
    .eq('factureId', factureId);
  if (lignesError) throw lignesError;

  const { data: paiements, error: paiementsError } = await supabase
    .from('paiement')
    .select(PAIEMENT_FIELDS)
    .eq('factureId', factureId)
    .order('datePaiement', { ascending: false });
  if (paiementsError) throw paiementsError;

  const { data: eleve, error: eleveError } = await supabase
    .from('eleve')
    .select('id, nom, prenoms, matricule, statut')
    .eq('id', f.eleveId)
    .single();
  if (eleveError) throw eleveError;

  const { data: inscription } = await supabase
    .from('inscription')
    .select('classe:classe(nom)')
    .eq('eleveId', f.eleveId)
    .eq('anneeScolaireId', f.anneeScolaireId)
    .maybeSingle();

  const { data: annee } = await supabase
    .from('annee_scolaire')
    .select('libelle')
    .eq('id', f.anneeScolaireId)
    .maybeSingle();

  const paiementsList = (paiements ?? []) as unknown as PaiementFacture[];

  return {
    ...f,
    lignes: (lignes ?? []) as unknown as LigneFacture[],
    paiements: paiementsList,
    totalPaye: totalPaye(paiementsList),
    solde: calculerSolde(f.montantTotal, paiementsList),
    lignesModifiables:
      f.statut !== 'ANNULE' && paiementsList.filter((p) => p.statut !== 'ANNULE').length === 0,
    eleve: eleve as unknown as FactureDetail['eleve'],
    classeNom:
      (inscription as unknown as { classe: { nom: string } | null } | null)?.classe?.nom ?? null,
    anneeLibelle: (annee as { libelle: string } | null)?.libelle ?? null,
  };
}

/**
 * Suivi des paiements : une ligne par facture de l'année, avec le reste à
 * recouvrer. Les totaux sont agrégés côté application plutôt qu'en SQL parce
 * que la même liste sert à l'export et que le volume reste à l'échelle d'un
 * établissement (quelques centaines de factures par année).
 */
export async function listSuiviPaiements(
  anneeScolaireId: string,
  filtres: { classeId?: string; statut?: StatutFacture } = {},
): Promise<SuiviPaiementLigne[]> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE');
  const supabase = createClient();

  let query = supabase
    .from('facture_eleve')
    .select(FACTURE_FIELDS)
    .eq('etablissementId', ctx.etablissementId)
    .eq('anneeScolaireId', anneeScolaireId);
  if (filtres.statut) query = query.eq('statut', filtres.statut);
  const { data: factures, error } = await query;
  if (error) throw error;

  const rows = (factures ?? []) as unknown as Omit<FactureEleve, 'lignes'>[];
  if (rows.length === 0) return [];

  const eleveIds = [...new Set(rows.map((f) => f.eleveId))];
  const factureIds = rows.map((f) => f.id);

  const { data: eleves, error: elevesError } = await supabase
    .from('eleve')
    .select('id, nom, prenoms, matricule')
    .in('id', eleveIds);
  if (elevesError) throw elevesError;
  const eleveParId = new Map(
    (eleves ?? []).map((e: { id: string }) => [e.id, e as unknown as SuiviPaiementLigne]),
  );

  const { data: inscriptions, error: insError } = await supabase
    .from('inscription')
    .select('"eleveId", "classeId", classe:classe(id, nom)')
    .eq('anneeScolaireId', anneeScolaireId)
    .in('eleveId', eleveIds);
  if (insError) throw insError;
  const inscriptionRows = (inscriptions ?? []) as unknown as {
    eleveId: string;
    classeId: string;
    classe: { nom: string } | null;
  }[];
  const classeParEleve = new Map(
    inscriptionRows.map((i) => [i.eleveId, { id: i.classeId, nom: i.classe?.nom ?? null }]),
  );

  const { data: paiements, error: paiementsError } = await supabase
    .from('paiement')
    .select('"factureId", montant, statut')
    .in('factureId', factureIds);
  if (paiementsError) throw paiementsError;
  const paiementsParFacture = new Map<string, { montant: number; statut: StatutPaiement }[]>();
  for (const p of (paiements ?? []) as unknown as {
    factureId: string;
    montant: number;
    statut: StatutPaiement;
  }[]) {
    if (!paiementsParFacture.has(p.factureId)) paiementsParFacture.set(p.factureId, []);
    paiementsParFacture.get(p.factureId)!.push(p);
  }

  const lignes: SuiviPaiementLigne[] = rows.map((f) => {
    const eleve = eleveParId.get(f.eleveId);
    const classe = classeParEleve.get(f.eleveId);
    const paiementsFacture = paiementsParFacture.get(f.id) ?? [];
    return {
      factureId: f.id,
      eleveId: f.eleveId,
      matricule: eleve?.matricule ?? '',
      nom: eleve?.nom ?? '',
      prenoms: eleve?.prenoms ?? '',
      classeId: classe?.id ?? null,
      classeNom: classe?.nom ?? null,
      montantTotal: Number(f.montantTotal),
      totalPaye: totalPaye(paiementsFacture),
      solde: calculerSolde(f.montantTotal, paiementsFacture),
      statut: f.statut,
    };
  });

  const filtrees = filtres.classeId
    ? lignes.filter((l) => l.classeId === filtres.classeId)
    : lignes;

  return filtrees.sort((a, b) => `${a.nom} ${a.prenoms}`.localeCompare(`${b.nom} ${b.prenoms}`));
}

/** Totaux d'un suivi — affichés en pied de tableau (maquette « Suivi des paiements »). */
export function totauxSuivi(lignes: SuiviPaiementLigne[]): {
  montantTotal: number;
  totalPaye: number;
  solde: number;
} {
  return lignes.reduce(
    (acc, l) => ({
      montantTotal: acc.montantTotal + l.montantTotal,
      totalPaye: acc.totalPaye + l.totalPaye,
      solde: acc.solde + l.solde,
    }),
    { montantTotal: 0, totalPaye: 0, solde: 0 },
  );
}

// ------------------------------------------------------------------
// Écriture — via RPC transactionnelles (0008_phase6_finance_rpc.sql)
// ------------------------------------------------------------------

export interface LigneFactureInput {
  typeFraisId: string;
  designation: string;
  montant: number;
}

/**
 * Remplace les lignes d'une facture (remises, frais spéciaux, cas
 * particuliers — doc 08 §8/§9) et recalcule le total puis le statut. Refusé
 * dès qu'un versement est encaissé : la règle est portée par la RPC, pas
 * seulement par l'UI.
 */
export async function modifierLignesFacture(
  factureId: string,
  lignes: LigneFactureInput[],
): Promise<void> {
  await requireRole('COMPTABLE');
  const supabase = createClient();

  const avant = await getFactureDetail(factureId);

  const { error } = await supabase.rpc('fn_modifier_lignes_facture', {
    p_facture_id: factureId,
    p_lignes: lignes.map((l) => ({
      typeFraisId: l.typeFraisId,
      designation: l.designation,
      montant: l.montant,
    })),
  });
  if (error) throw new Error(error.message);

  await auditLog({
    action: 'MODIFIER_LIGNES_FACTURE',
    module: 'finance',
    objetType: 'FactureEleve',
    objetId: factureId,
    ancienneValeur: { montantTotal: avant.montantTotal, lignes: avant.lignes },
    nouvelleValeur: { lignes },
  });
}

/** Annule une facture (statut ANNULE, jamais de suppression — doc 08 §14). */
export async function annulerFacture(factureId: string): Promise<void> {
  await requireRole('COMPTABLE');
  const supabase = createClient();

  const avant = await getFactureDetail(factureId);

  const { error } = await supabase.rpc('fn_annuler_facture', { p_facture_id: factureId });
  if (error) throw new Error(error.message);

  await auditLog({
    action: 'ANNULER_FACTURE',
    module: 'finance',
    objetType: 'FactureEleve',
    objetId: factureId,
    ancienneValeur: { statut: avant.statut, montantTotal: avant.montantTotal },
    nouvelleValeur: { statut: 'ANNULE' },
  });
}

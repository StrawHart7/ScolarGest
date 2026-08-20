import { createClient } from '@/lib/supabase/server';
import { requireRole } from './authorization';
import { auditLog } from './audit';

export type ModePaiement = 'ESPECES' | 'CHEQUE' | 'VIREMENT' | 'MOBILE_MONEY' | 'AUTRE';
export type StatutPaiement = 'PAYE' | 'PARTIEL' | 'IMPAYE' | 'ANNULE';

/**
 * Encaissements sur les factures élèves. La lecture (`getPaiementDetail`)
 * existe depuis la Phase 5 pour alimenter le reçu PDF ; l'écriture est
 * ajoutée ici en Phase 6.
 *
 * Toute écriture passe par une RPC transactionnelle
 * (`0008_phase6_finance_rpc.sql`) : le versement et le repositionnement du
 * statut de la facture doivent être atomiques, sinon une facture peut rester
 * IMPAYE alors qu'elle est soldée.
 */
export interface PaiementDetail {
  id: string;
  factureId: string;
  montant: number;
  datePaiement: string;
  modePaiement: ModePaiement;
  reference: string | null;
  statut: StatutPaiement;
  eleve: {
    id: string;
    nom: string;
    prenoms: string;
    matricule: string;
  };
  classeNom: string | null;
  responsablePrincipal: {
    nom: string;
    prenoms: string;
  } | null;
  etablissementId: string;
}

interface PaiementRow {
  id: string;
  factureId: string;
  montant: number;
  datePaiement: string;
  modePaiement: ModePaiement;
  reference: string | null;
  statut: StatutPaiement;
}

/** Détail d'un paiement avec jointure facture -> élève -> responsable principal, pour le reçu. */
export async function getPaiementDetail(id: string): Promise<PaiementDetail> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE');
  const supabase = createClient();

  const { data: paiement, error } = await supabase
    .from('paiement')
    .select('id, "factureId", montant, "datePaiement", "modePaiement", reference, statut')
    .eq('id', id)
    .single();
  if (error) throw error;
  const p = paiement as unknown as PaiementRow;

  const { data: facture, error: factureError } = await supabase
    .from('facture_eleve')
    .select('id, "etablissementId", "eleveId", "anneeScolaireId"')
    .eq('id', p.factureId)
    .eq('etablissementId', ctx.etablissementId)
    .single();
  if (factureError) throw factureError;

  const { data: eleve, error: eleveError } = await supabase
    .from('eleve')
    .select('id, nom, prenoms, matricule')
    .eq('id', facture.eleveId)
    .single();
  if (eleveError) throw eleveError;

  const { data: inscription } = await supabase
    .from('inscription')
    .select('classe:classe(nom)')
    .eq('eleveId', facture.eleveId)
    .eq('anneeScolaireId', facture.anneeScolaireId)
    .maybeSingle();

  const { data: respLien } = await supabase
    .from('eleve_responsable')
    .select('responsable:responsable(nom, prenoms)')
    .eq('eleveId', facture.eleveId)
    .eq('principal', true)
    .maybeSingle();

  return {
    id: p.id,
    factureId: p.factureId,
    montant: p.montant,
    datePaiement: p.datePaiement,
    modePaiement: p.modePaiement,
    reference: p.reference,
    statut: p.statut,
    eleve: eleve as unknown as PaiementDetail['eleve'],
    classeNom:
      (inscription as unknown as { classe: { nom: string } | null } | null)?.classe?.nom ?? null,
    responsablePrincipal:
      (respLien as unknown as { responsable: { nom: string; prenoms: string } | null } | null)
        ?.responsable ?? null,
    etablissementId: facture.etablissementId,
  };
}

// ------------------------------------------------------------------
// Historique global des versements
// ------------------------------------------------------------------

export interface PaiementHistorique {
  id: string;
  montant: number;
  datePaiement: string;
  modePaiement: ModePaiement;
  reference: string | null;
  statut: StatutPaiement;
  factureId: string;
  eleveId: string;
  eleveNom: string;
  elevePrenoms: string;
  eleveMatricule: string;
  recuReference: string | null;
}

/**
 * Historique des versements d'une année scolaire, du plus récent au plus
 * ancien. Le reçu déjà généré (le cas échéant) est joint pour que l'écran
 * propose « Télécharger » plutôt que de regénérer un doublon.
 */
export async function listPaiements(
  anneeScolaireId: string,
  filtres: { statut?: StatutPaiement; eleveId?: string } = {},
): Promise<PaiementHistorique[]> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE');
  const supabase = createClient();

  let facturesQuery = supabase
    .from('facture_eleve')
    .select('id, "eleveId"')
    .eq('etablissementId', ctx.etablissementId)
    .eq('anneeScolaireId', anneeScolaireId);
  if (filtres.eleveId) facturesQuery = facturesQuery.eq('eleveId', filtres.eleveId);
  const { data: factures, error: facturesError } = await facturesQuery;
  if (facturesError) throw facturesError;

  const factureRows = (factures ?? []) as unknown as { id: string; eleveId: string }[];
  if (factureRows.length === 0) return [];
  const eleveParFacture = new Map(factureRows.map((f) => [f.id, f.eleveId]));

  let paiementsQuery = supabase
    .from('paiement')
    .select('id, "factureId", montant, "datePaiement", "modePaiement", reference, statut')
    .in('factureId', factureRows.map((f) => f.id))
    .order('datePaiement', { ascending: false });
  if (filtres.statut) paiementsQuery = paiementsQuery.eq('statut', filtres.statut);
  const { data: paiements, error } = await paiementsQuery;
  if (error) throw error;

  const paiementRows = (paiements ?? []) as unknown as (PaiementRow & { factureId: string })[];
  if (paiementRows.length === 0) return [];

  const eleveIds = [...new Set(factureRows.map((f) => f.eleveId))];
  const { data: eleves, error: elevesError } = await supabase
    .from('eleve')
    .select('id, nom, prenoms, matricule')
    .in('id', eleveIds);
  if (elevesError) throw elevesError;
  const eleveParId = new Map(
    (eleves ?? []).map((e: { id: string; nom: string; prenoms: string; matricule: string }) => [
      e.id,
      e,
    ]),
  );

  const { data: recus } = await supabase
    .from('document')
    .select('reference, "objetId"')
    .eq('etablissementId', ctx.etablissementId)
    .eq('type', 'RECU')
    .eq('statut', 'GENERE')
    .in('objetId', paiementRows.map((p) => p.id));
  const recuParPaiement = new Map(
    ((recus ?? []) as { reference: string; objetId: string }[]).map((d) => [d.objetId, d.reference]),
  );

  return paiementRows.map((p) => {
    const eleveId = eleveParFacture.get(p.factureId) ?? '';
    const eleve = eleveParId.get(eleveId);
    return {
      id: p.id,
      montant: Number(p.montant),
      datePaiement: p.datePaiement,
      modePaiement: p.modePaiement,
      reference: p.reference,
      statut: p.statut,
      factureId: p.factureId,
      eleveId,
      eleveNom: eleve?.nom ?? '',
      elevePrenoms: eleve?.prenoms ?? '',
      eleveMatricule: eleve?.matricule ?? '',
      recuReference: recuParPaiement.get(p.id) ?? null,
    };
  });
}

// ------------------------------------------------------------------
// Écriture
// ------------------------------------------------------------------

export interface EnregistrerPaiementInput {
  factureId: string;
  montant: number;
  modePaiement: ModePaiement;
  reference?: string | null;
  datePaiement?: string | null;
}

export interface ResultatPaiement {
  paiementId: string;
  montantTotal: number;
  totalPaye: number;
  solde: number;
  statut: 'PAYE' | 'PARTIEL' | 'IMPAYE' | 'ANNULE';
}

/**
 * Enregistre un versement (paiement par tranches, doc 08 §11). La référence
 * est exigée pour tout mode autre qu'espèces : sans elle un chèque, un
 * virement ou un Mobile Money n'est pas rapprochable, et c'est la seule trace
 * exploitable en cas de litige avec une famille.
 */
export async function enregistrerPaiement(
  input: EnregistrerPaiementInput,
): Promise<ResultatPaiement> {
  await requireRole('COMPTABLE');

  if (!Number.isFinite(input.montant) || input.montant <= 0) {
    throw new Error('Le montant du versement doit être strictement positif.');
  }
  if (input.modePaiement !== 'ESPECES' && !input.reference?.trim()) {
    throw new Error('Une référence est requise pour un chèque, un virement ou un Mobile Money.');
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc('fn_enregistrer_paiement', {
    p_facture_id: input.factureId,
    p_montant: input.montant,
    p_mode_paiement: input.modePaiement,
    p_reference: input.reference ?? null,
    p_date_paiement: input.datePaiement ?? null,
  });
  if (error) throw new Error(error.message);

  const resultat = data as unknown as ResultatPaiement;

  await auditLog({
    action: 'ENREGISTRER_PAIEMENT',
    module: 'finance',
    objetType: 'Paiement',
    objetId: resultat.paiementId,
    nouvelleValeur: {
      factureId: input.factureId,
      montant: input.montant,
      modePaiement: input.modePaiement,
      reference: input.reference ?? null,
      soldeApres: resultat.solde,
      statutFacture: resultat.statut,
    },
  });

  return resultat;
}

/**
 * Annule un versement : statut ANNULE, jamais de suppression (doc 08 §14).
 * La correction consiste à enregistrer ensuite un nouveau versement avec les
 * bonnes informations — le mouvement inverse reste donc lisible dans
 * l'historique et dans l'audit.
 */
export async function annulerPaiement(paiementId: string, motif?: string): Promise<void> {
  await requireRole('COMPTABLE');
  const supabase = createClient();

  const { data: avant } = await supabase
    .from('paiement')
    .select('id, "factureId", montant, "modePaiement", reference, statut')
    .eq('id', paiementId)
    .maybeSingle();

  const { data, error } = await supabase.rpc('fn_annuler_paiement', {
    p_paiement_id: paiementId,
  });
  if (error) throw new Error(error.message);

  await auditLog({
    action: 'ANNULER_PAIEMENT',
    module: 'finance',
    objetType: 'Paiement',
    objetId: paiementId,
    ancienneValeur: avant ?? undefined,
    nouvelleValeur: { statut: 'ANNULE', motif: motif ?? null, facture: data },
  });
}

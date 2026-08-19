import { createClient } from '@/lib/supabase/server';
import { requireRole } from './authorization';

export type ModePaiement = 'ESPECES' | 'CHEQUE' | 'VIREMENT' | 'MOBILE_MONEY' | 'AUTRE';
export type StatutPaiement = 'PAYE' | 'PARTIEL' | 'IMPAYE' | 'ANNULE';

/**
 * Service minimal et en lecture seule (Phase 5): l'enregistrement d'un
 * paiement (créerPaiement, annulation, etc.) est réservé à la Phase 6.
 * Existe seulement pour permettre de générer un reçu si un `Paiement` existe
 * déjà en base — voir `src/services/recu.ts`.
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

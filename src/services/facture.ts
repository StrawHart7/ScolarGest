import { createClient } from '@/lib/supabase/server';
import { requireRole } from './authorization';

export type StatutFacture = 'PAYE' | 'PARTIEL' | 'IMPAYE' | 'ANNULE';

export interface LigneFacture {
  id: string;
  factureId: string;
  typeFraisId: string;
  designation: string;
  montant: number;
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

export async function getFacturesEleve(eleveId: string): Promise<FactureEleve[]> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE');
  const supabase = createClient();
  const { data: factures, error } = await supabase
    .from('facture_eleve')
    .select('id, "etablissementId", "eleveId", "anneeScolaireId", "montantTotal", statut, "dateCreation"')
    .eq('etablissementId', ctx.etablissementId)
    .eq('eleveId', eleveId)
    .order('dateCreation', { ascending: false });
  if (error) throw error;

  const result: FactureEleve[] = [];
  for (const f of factures ?? []) {
    const { data: lignes, error: lignesError } = await supabase
      .from('ligne_facture')
      .select('id, "factureId", "typeFraisId", designation, montant')
      .eq('factureId', f.id);
    if (lignesError) throw lignesError;
    result.push({ ...(f as unknown as Omit<FactureEleve, 'lignes'>), lignes: lignes ?? [] });
  }
  return result;
}

/**
 * Solde restant dû sur une facture. Phase 2 : aucun paiement géré en UI
 * (Phase 6), donc solde = montantTotal. Isolée en fonction pure pour rester
 * réutilisable telle quelle quand `paiement` sera pris en compte.
 */
export function calculerSoldeFacture(facture: Pick<FactureEleve, 'montantTotal'>): number {
  return facture.montantTotal;
}

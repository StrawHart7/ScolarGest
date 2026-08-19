import { createClient } from '@/lib/supabase/server';
import { requireRole } from './authorization';
import { auditLog } from './audit';

export type StatutTypeFrais = 'ACTIF' | 'INACTIF';

export interface TypeFrais {
  id: string;
  etablissementId: string;
  nom: string;
  description: string | null;
  statut: StatutTypeFrais;
}

export interface CreateTypeFraisInput {
  nom: string;
  description?: string;
}

export interface UpdateTypeFraisInput {
  nom?: string;
  description?: string | null;
  statut?: StatutTypeFrais;
}

const TYPE_FRAIS_FIELDS = 'id, "etablissementId", nom, description, statut';

/**
 * Catégories de frais de l'établissement (scolarité, inscription, cantine…).
 * Lecture ouverte au Directeur et à la Secrétaire (consultation), écriture
 * réservée au Comptable et au Directeur — cf. doc 08 §17.
 *
 * Contrairement à `TarifScolaire`, un `TypeFrais` reste modifiable : il ne
 * porte aucun montant, seulement un libellé. Il n'est jamais supprimé non
 * plus (les factures historiques le référencent) — on le passe INACTIF pour
 * le retirer des nouveaux tarifs.
 */
export async function listTypesFrais(inclureInactifs = false): Promise<TypeFrais[]> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE');
  const supabase = createClient();
  let query = supabase
    .from('type_frais')
    .select(TYPE_FRAIS_FIELDS)
    .eq('etablissementId', ctx.etablissementId);
  if (!inclureInactifs) query = query.eq('statut', 'ACTIF');
  const { data, error } = await query.order('nom');
  if (error) throw error;
  return (data ?? []) as unknown as TypeFrais[];
}

export async function createTypeFrais(input: CreateTypeFraisInput): Promise<TypeFrais> {
  const ctx = await requireRole('COMPTABLE');
  const supabase = createClient();
  const { data, error } = await supabase
    .from('type_frais')
    .insert({
      etablissementId: ctx.etablissementId,
      nom: input.nom,
      description: input.description || null,
    })
    .select(TYPE_FRAIS_FIELDS)
    .single();
  if (error) {
    if (error.code === '23505') {
      throw new Error('Un type de frais porte déjà ce nom.');
    }
    throw error;
  }

  await auditLog({
    action: 'CREATE_TYPE_FRAIS',
    module: 'finance',
    objetType: 'TypeFrais',
    objetId: data.id,
    nouvelleValeur: { nom: input.nom, description: input.description ?? null },
  });

  return data as unknown as TypeFrais;
}

export async function updateTypeFrais(
  id: string,
  input: UpdateTypeFraisInput,
): Promise<TypeFrais> {
  const ctx = await requireRole('COMPTABLE');
  const supabase = createClient();

  const { data: avant } = await supabase
    .from('type_frais')
    .select(TYPE_FRAIS_FIELDS)
    .eq('id', id)
    .eq('etablissementId', ctx.etablissementId)
    .maybeSingle();
  if (!avant) throw new Error('Type de frais introuvable.');

  const { data, error } = await supabase
    .from('type_frais')
    .update({
      ...(input.nom !== undefined ? { nom: input.nom } : {}),
      ...(input.description !== undefined ? { description: input.description || null } : {}),
      ...(input.statut !== undefined ? { statut: input.statut } : {}),
    })
    .eq('id', id)
    .eq('etablissementId', ctx.etablissementId)
    .select(TYPE_FRAIS_FIELDS)
    .single();
  if (error) {
    if (error.code === '23505') {
      throw new Error('Un type de frais porte déjà ce nom.');
    }
    throw error;
  }

  await auditLog({
    action: 'UPDATE_TYPE_FRAIS',
    module: 'finance',
    objetType: 'TypeFrais',
    objetId: id,
    ancienneValeur: avant,
    nouvelleValeur: input,
  });

  return data as unknown as TypeFrais;
}

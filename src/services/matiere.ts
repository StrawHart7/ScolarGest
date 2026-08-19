import { createClient } from '@/lib/supabase/server';
import { requireRole } from './authorization';
import { auditLog } from './audit';

export type StatutMatiere = 'ACTIF' | 'INACTIF';

export interface Matiere {
  id: string;
  etablissementId: string;
  nom: string;
  code: string | null;
  description: string | null;
  statut: StatutMatiere;
}

export interface CreateMatiereInput {
  nom: string;
  code?: string;
  description?: string;
}

export interface UpdateMatiereInput {
  nom?: string;
  code?: string | null;
  description?: string | null;
  statut?: StatutMatiere;
}

const MATIERE_FIELDS = 'id, "etablissementId", nom, code, description, statut';

/**
 * Service minimal (Phase 3) : liste + création simple, pour peupler le select
 * d'affectation enseignant×classe×matière. Programme, coefficients et gestion
 * complète des matières viendront en Phase 4 sans recréer ce fichier.
 */
export async function listMatieres(): Promise<Matiere[]> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'ENSEIGNANT');
  const supabase = createClient();
  const { data, error } = await supabase
    .from('matiere')
    .select(MATIERE_FIELDS)
    .eq('etablissementId', ctx.etablissementId)
    .order('nom');
  if (error) throw error;
  return (data ?? []) as unknown as Matiere[];
}

export async function createMatiere(input: CreateMatiereInput): Promise<Matiere> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE');
  const supabase = createClient();
  const { data, error } = await supabase
    .from('matiere')
    .insert({
      etablissementId: ctx.etablissementId,
      nom: input.nom,
      code: input.code || null,
      description: input.description || null,
    })
    .select(MATIERE_FIELDS)
    .single();
  if (error) throw error;

  await auditLog({
    action: 'CREATE_MATIERE',
    module: 'academique',
    objetType: 'Matiere',
    objetId: data.id,
    nouvelleValeur: { nom: input.nom },
  });

  return data as unknown as Matiere;
}

export async function getMatiere(id: string): Promise<Matiere | null> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'ENSEIGNANT');
  const supabase = createClient();
  const { data, error } = await supabase
    .from('matiere')
    .select(MATIERE_FIELDS)
    .eq('id', id)
    .eq('etablissementId', ctx.etablissementId)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as Matiere) ?? null;
}

export async function updateMatiere(id: string, data: UpdateMatiereInput): Promise<Matiere> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE');
  const supabase = createClient();
  const { data: updated, error } = await supabase
    .from('matiere')
    .update({
      ...(data.nom !== undefined ? { nom: data.nom } : {}),
      ...(data.code !== undefined ? { code: data.code || null } : {}),
      ...(data.description !== undefined ? { description: data.description || null } : {}),
      ...(data.statut !== undefined ? { statut: data.statut } : {}),
    })
    .eq('id', id)
    .eq('etablissementId', ctx.etablissementId)
    .select(MATIERE_FIELDS)
    .single();
  if (error) throw error;

  await auditLog({
    action: 'UPDATE_MATIERE',
    module: 'academique',
    objetType: 'Matiere',
    objetId: id,
    nouvelleValeur: data,
  });

  return updated as unknown as Matiere;
}

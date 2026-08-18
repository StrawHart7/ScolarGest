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

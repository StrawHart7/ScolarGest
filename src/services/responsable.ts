import { createClient } from '@/lib/supabase/server';
import { requireRole } from './authorization';
import { auditLog } from './audit';
import type { ResponsableInput, TypeResponsable } from './eleve';

export interface Responsable {
  id: string;
  etablissementId: string;
  nom: string;
  prenoms: string;
  telephone: string | null;
  email: string | null;
  adresse: string | null;
  profession: string | null;
  type: TypeResponsable;
}

export interface ResponsableEleve {
  id: string;
  eleveId: string;
  responsableId: string;
  lienParente: string;
  principal: boolean;
  responsable: Responsable;
}

export async function listResponsablesEleve(eleveId: string): Promise<ResponsableEleve[]> {
  await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE');
  const supabase = createClient();
  const { data, error } = await supabase
    .from('eleve_responsable')
    .select('id, "eleveId", "responsableId", "lienParente", principal, responsable:responsable(*)')
    .eq('eleveId', eleveId);
  if (error) throw error;
  return (data ?? []) as unknown as ResponsableEleve[];
}

export interface UpdateResponsableInput {
  nom?: string;
  prenoms?: string;
  telephone?: string | null;
  email?: string | null;
  adresse?: string | null;
  profession?: string | null;
  type?: TypeResponsable;
}

export async function updateResponsable(id: string, input: UpdateResponsableInput): Promise<void> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE');
  const supabase = createClient();
  const { error } = await supabase
    .from('responsable')
    .update(input)
    .eq('id', id)
    .eq('etablissementId', ctx.etablissementId);
  if (error) throw error;

  await auditLog({
    action: 'UPDATE_RESPONSABLE',
    module: 'eleves',
    objetType: 'Responsable',
    objetId: id,
    nouvelleValeur: input,
  });
}

/**
 * Ajoute un responsable (nouveau ou existant) à un élève déjà créé, hors
 * flux de création initiale. Passe par la RPC dédiée qui garantit qu'au plus
 * un lien reste `principal=true` par élève.
 */
export async function linkResponsableEleve(eleveId: string, input: ResponsableInput): Promise<string> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE');
  const supabase = createClient();

  const { data, error } = await supabase.rpc('fn_lier_responsable_eleve', {
    p_etablissement_id: ctx.etablissementId,
    p_eleve_id: eleveId,
    p_responsable: input,
  });
  if (error) throw new Error(error.message);

  await auditLog({
    action: 'LIER_RESPONSABLE',
    module: 'eleves',
    objetType: 'Eleve',
    objetId: eleveId,
    nouvelleValeur: { responsableId: data },
  });

  return data as string;
}

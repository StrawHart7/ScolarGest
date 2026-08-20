import { createClient } from '@/lib/supabase/server';
import { requireRole } from './authorization';
import { exigerPin } from './pin';
import { auditLog } from './audit';

export interface Cycle {
  id: string;
  nom: string;
  ordre: number;
}

export interface CycleEtablissement {
  id: string;
  cycleId: string;
  actif: boolean;
  cycle: Cycle;
}

export interface Niveau {
  id: string;
  cycleId: string;
  nom: string;
  ordre: number;
}

export interface Serie {
  id: string;
  cycleId: string;
  nom: string;
}

export async function listCycles(): Promise<Cycle[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from('cycle').select('id, nom, ordre').order('ordre');
  if (error) throw error;
  return data ?? [];
}

export async function listCyclesActifs(): Promise<CycleEtablissement[]> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE', 'ENSEIGNANT');
  const supabase = createClient();
  const { data, error } = await supabase
    .from('cycle_etablissement')
    .select('id, "cycleId", actif, cycle:cycle(id, nom, ordre)')
    .eq('etablissementId', ctx.etablissementId)
    .eq('actif', true);
  if (error) throw error;
  return (data ?? []) as unknown as CycleEtablissement[];
}

/**
 * L'activation d'un cycle est définitive : une fois activé, il ne peut plus
 * être modifié. Elle exige donc le PIN de confirmation du Directeur.
 */
export async function activerCycle(cycleId: string, pin: string): Promise<void> {
  const ctx = await requireRole('DIRECTEUR');
  await exigerPin(pin, 'DIRECTEUR');
  const supabase = createClient();
  const { error } = await supabase
    .from('cycle_etablissement')
    .upsert(
      { etablissementId: ctx.etablissementId, cycleId, actif: true },
      { onConflict: 'etablissementId,cycleId' },
    );
  if (error) throw error;

  await auditLog({
    action: 'ACTIVER_CYCLE',
    module: 'structure',
    objetType: 'CycleEtablissement',
    objetId: cycleId,
  });
}

export async function listNiveauxParCycle(cycleId: string): Promise<Niveau[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('niveau')
    .select('id, "cycleId", nom, ordre')
    .eq('cycleId', cycleId)
    .order('ordre');
  if (error) throw error;
  return data ?? [];
}

export async function listSeriesParCycle(cycleId: string): Promise<Serie[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('serie')
    .select('id, "cycleId", nom')
    .eq('cycleId', cycleId)
    .order('nom');
  if (error) throw error;
  return data ?? [];
}

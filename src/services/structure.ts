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

/**
 * Catalogues système (cycles, niveaux, séries) : aucune donnée de tenant, mais
 * une session reste exigée. Une lecture ouverte sans authentification n'a pas
 * de justification, et l'absence de garde faisait de ces trois fonctions les
 * seules lectures anonymes du domaine scolaire.
 */
/**
 * Cycles proposables à la configuration.
 *
 * Filtre sur `disponible` : depuis le recentrage sur le secondaire (migration
 * `0014`), la maternelle et le primaire sont hors catalogue. Les lignes sont
 * conservées en base — les établissements qui les avaient activées continuent
 * de fonctionner — mais plus personne ne peut les choisir.
 */
export async function listCycles(): Promise<Cycle[]> {
  await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE', 'ENSEIGNANT');
  const supabase = createClient();
  const { data, error } = await supabase
    .from('cycle')
    .select('id, nom, ordre')
    .eq('disponible', true)
    .order('ordre');
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

  // Le `cycleId` vient de l'appelant : masquer un cycle retiré dans
  // `listCycles()` ne suffit pas à empêcher de l'activer par un appel forgé.
  // Le refus doit vivre ici, sur le chemin d'écriture.
  const { data: cycle, error: erreurCycle } = await supabase
    .from('cycle')
    .select('nom, disponible')
    .eq('id', cycleId)
    .maybeSingle();
  if (erreurCycle) throw erreurCycle;
  if (!cycle) throw new Error("Ce cycle n'existe pas.");
  if (!(cycle as { disponible: boolean }).disponible) {
    throw new Error(
      `Le cycle ${(cycle as { nom: string }).nom} n'est plus proposé : ScolarGest couvre le collège et le lycée.`,
    );
  }

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
  await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE', 'ENSEIGNANT');
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
  await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE', 'ENSEIGNANT');
  const supabase = createClient();
  const { data, error } = await supabase
    .from('serie')
    .select('id, "cycleId", nom')
    .eq('cycleId', cycleId)
    .order('nom');
  if (error) throw error;
  return data ?? [];
}

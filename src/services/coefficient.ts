import { createClient } from '@/lib/supabase/server';
import { requireRole } from './authorization';
import { auditLog } from './audit';

export interface Coefficient {
  id: string;
  programmeEtablissementId: string;
  anneeScolaireId: string;
  serieId: string | null;
  coefficient: number;
}

const COEFFICIENT_FIELDS = 'id, "programmeEtablissementId", "anneeScolaireId", "serieId", coefficient';

/**
 * Coefficient actif pour un programme×année×série donné. `serieId` peut être
 * null (niveaux sans série, ex: collège) — la contrainte unique DB couvre
 * aussi ce cas via NULL.
 */
export async function getCoefficient(
  programmeEtablissementId: string,
  anneeScolaireId: string,
  serieId: string | null,
): Promise<Coefficient | null> {
  await requireRole('DIRECTEUR', 'SECRETAIRE', 'ENSEIGNANT');
  const supabase = createClient();
  let query = supabase
    .from('coefficient_matiere')
    .select(COEFFICIENT_FIELDS)
    .eq('programmeEtablissementId', programmeEtablissementId)
    .eq('anneeScolaireId', anneeScolaireId);
  query = serieId === null ? query.is('serieId', null) : query.eq('serieId', serieId);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return (data as unknown as Coefficient) ?? null;
}

/**
 * Upsert historisé : une ligne par (programmeEtablissementId, anneeScolaireId,
 * serieId). Même année → update en place (pas de doublon). Nouvelle année →
 * nouvelle ligne, le passé n'est jamais modifié.
 */
export async function definirCoefficient(
  programmeEtablissementId: string,
  anneeScolaireId: string,
  serieId: string | null,
  coefficient: number,
): Promise<Coefficient> {
  await requireRole('DIRECTEUR', 'SECRETAIRE');
  const supabase = createClient();

  const existing = await getCoefficient(programmeEtablissementId, anneeScolaireId, serieId);

  if (existing) {
    const { data, error } = await supabase
      .from('coefficient_matiere')
      .update({ coefficient })
      .eq('id', existing.id)
      .select(COEFFICIENT_FIELDS)
      .single();
    if (error) throw error;

    await auditLog({
      action: 'DEFINIR_COEFFICIENT',
      module: 'academique',
      objetType: 'CoefficientMatiere',
      objetId: existing.id,
      ancienneValeur: { coefficient: existing.coefficient },
      nouvelleValeur: { coefficient },
    });

    return data as unknown as Coefficient;
  }

  const { data, error } = await supabase
    .from('coefficient_matiere')
    .insert({
      programmeEtablissementId,
      anneeScolaireId,
      serieId,
      coefficient,
    })
    .select(COEFFICIENT_FIELDS)
    .single();
  if (error) throw error;

  await auditLog({
    action: 'DEFINIR_COEFFICIENT',
    module: 'academique',
    objetType: 'CoefficientMatiere',
    objetId: data.id,
    nouvelleValeur: { programmeEtablissementId, anneeScolaireId, serieId, coefficient },
  });

  return data as unknown as Coefficient;
}

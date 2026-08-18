import { createClient } from '@/lib/supabase/server';
import { requireRole } from './authorization';
import { auditLog } from './audit';

export interface TitulaireClasse {
  id: string;
  anneeScolaireId: string;
  classeId: string;
  enseignantId: string;
  enseignant: { nom: string; prenoms: string };
}

const TITULARITE_FIELDS =
  'id, "anneeScolaireId", "classeId", "enseignantId", enseignant:enseignant(nom, prenoms)';

export async function getTitulaire(
  classeId: string,
  anneeScolaireId: string,
): Promise<TitulaireClasse | null> {
  await requireRole('DIRECTEUR', 'SECRETAIRE', 'ENSEIGNANT');
  const supabase = createClient();
  const { data, error } = await supabase
    .from('titularite_classe')
    .select(TITULARITE_FIELDS)
    .eq('classeId', classeId)
    .eq('anneeScolaireId', anneeScolaireId)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as TitulaireClasse) ?? null;
}

/**
 * 0 ou 1 titulaire par classe (contrainte DB `unique("classeId")`). Définir un
 * nouveau titulaire remplace toujours la ligne existante via upsert — jamais
 * de delete+insert qui laisserait une fenêtre sans titulaire en cas d'échec.
 */
export async function definirTitulaire(
  classeId: string,
  anneeScolaireId: string,
  enseignantId: string,
): Promise<void> {
  await requireRole('DIRECTEUR', 'SECRETAIRE');
  const supabase = createClient();
  const { error } = await supabase
    .from('titularite_classe')
    .upsert(
      { classeId, anneeScolaireId, enseignantId },
      { onConflict: 'classeId' },
    );
  if (error) throw error;

  await auditLog({
    action: 'DEFINIR_TITULAIRE',
    module: 'enseignants',
    objetType: 'TitulariteClasse',
    objetId: classeId,
    nouvelleValeur: { classeId, anneeScolaireId, enseignantId },
  });
}

export async function retirerTitulaire(classeId: string): Promise<void> {
  await requireRole('DIRECTEUR', 'SECRETAIRE');
  const supabase = createClient();
  const { error } = await supabase.from('titularite_classe').delete().eq('classeId', classeId);
  if (error) throw error;

  await auditLog({
    action: 'RETIRER_TITULAIRE',
    module: 'enseignants',
    objetType: 'TitulariteClasse',
    objetId: classeId,
  });
}

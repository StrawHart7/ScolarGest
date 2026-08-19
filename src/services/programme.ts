import { createClient } from '@/lib/supabase/server';
import { requireRole } from './authorization';
import { auditLog } from './audit';

export interface ProgrammeItem {
  id: string;
  etablissementId: string;
  niveauId: string;
  matiereId: string;
  obligatoire: boolean;
  ordreAffichage: number;
  matiere: { id: string; nom: string; code: string | null };
}

const PROGRAMME_FIELDS =
  'id, "etablissementId", "niveauId", "matiereId", obligatoire, "ordreAffichage", matiere:matiere(id, nom, code)';

/** Liste les matières du programme d'un niveau, triées par ordreAffichage. */
export async function listProgramme(niveauId: string): Promise<ProgrammeItem[]> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'ENSEIGNANT');
  const supabase = createClient();
  const { data, error } = await supabase
    .from('programme_etablissement')
    .select(PROGRAMME_FIELDS)
    .eq('etablissementId', ctx.etablissementId)
    .eq('niveauId', niveauId)
    .order('ordreAffichage');
  if (error) throw error;
  return (data ?? []) as unknown as ProgrammeItem[];
}

export async function ajouterMatiereAuProgramme(
  niveauId: string,
  matiereId: string,
  obligatoire: boolean,
  ordreAffichage: number,
): Promise<string> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE');
  const supabase = createClient();
  const { data, error } = await supabase
    .from('programme_etablissement')
    .insert({
      etablissementId: ctx.etablissementId,
      niveauId,
      matiereId,
      obligatoire,
      ordreAffichage,
    })
    .select('id')
    .single();
  if (error) {
    if (error.code === '23505') {
      throw new Error('Cette matière fait déjà partie du programme de ce niveau.');
    }
    throw error;
  }

  await auditLog({
    action: 'AJOUTER_MATIERE_PROGRAMME',
    module: 'academique',
    objetType: 'ProgrammeEtablissement',
    objetId: data.id,
    nouvelleValeur: { niveauId, matiereId, obligatoire, ordreAffichage },
  });

  return data.id as string;
}

/**
 * Retire une matière du programme. Bloqué si des évaluations existent déjà
 * pour cette matière sur une classe de ce niveau (préserve l'historique).
 */
export async function retirerDuProgramme(id: string): Promise<void> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE');
  const supabase = createClient();

  const { data: programme, error: programmeError } = await supabase
    .from('programme_etablissement')
    .select('id, "niveauId", "matiereId"')
    .eq('id', id)
    .eq('etablissementId', ctx.etablissementId)
    .single();
  if (programmeError) throw programmeError;

  const { data: classes, error: classesError } = await supabase
    .from('classe')
    .select('id')
    .eq('etablissementId', ctx.etablissementId)
    .eq('niveauId', programme.niveauId);
  if (classesError) throw classesError;

  const classeIds = (classes ?? []).map((c: { id: string }) => c.id);
  if (classeIds.length > 0) {
    const { count, error: evalError } = await supabase
      .from('evaluation')
      .select('id', { count: 'exact', head: true })
      .eq('matiereId', programme.matiereId)
      .in('classeId', classeIds);
    if (evalError) throw evalError;
    if ((count ?? 0) > 0) {
      throw new Error(
        'Impossible de retirer cette matière du programme : des évaluations existent déjà pour ce niveau.',
      );
    }
  }

  const { error } = await supabase
    .from('programme_etablissement')
    .delete()
    .eq('id', id)
    .eq('etablissementId', ctx.etablissementId);
  if (error) throw error;

  await auditLog({
    action: 'RETIRER_MATIERE_PROGRAMME',
    module: 'academique',
    objetType: 'ProgrammeEtablissement',
    objetId: id,
  });
}

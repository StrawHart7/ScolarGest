import { createClient } from '@/lib/supabase/server';
import { getTenantContext } from './tenant';

/**
 * Extrait l'année de début (YYYY) depuis la date de début de l'année scolaire.
 */
async function getAnneeDebut(anneeScolaireId: string): Promise<number> {
  const supabase = createClient();
  const { data: annee, error } = await supabase
    .from('annee_scolaire')
    .select('dateDebut')
    .eq('id', anneeScolaireId)
    .single();
  if (error || !annee) throw new Error('AnneeScolaire introuvable');
  return new Date(annee.dateDebut).getUTCFullYear();
}

function pad(n: number, width = 4): string {
  return String(n).padStart(width, '0');
}

/**
 * Format: ELV-{YYYY}-{seq:04}.
 * NOTE: le max+1 lu ici n'est pas atomique — remplacer par une séquence
 * Postgres dédiée par (etablissement, annee) pour éviter les collisions
 * sous forte concurrence.
 */
export async function generateMatriculeEleve(anneeScolaireId: string): Promise<string> {
  const ctx = await getTenantContext();
  const annee = await getAnneeDebut(anneeScolaireId);
  const prefix = `ELV-${annee}-`;
  const supabase = createClient();

  const { data: last, error } = await supabase
    .from('eleve')
    .select('matricule')
    .eq('etablissementId', ctx.etablissementId)
    .like('matricule', `${prefix}%`)
    .order('matricule', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;

  const nextSeq = last ? parseInt(last.matricule.slice(prefix.length), 10) + 1 : 1;
  return `${prefix}${pad(nextSeq)}`;
}

export async function generateMatriculeEnseignant(anneeScolaireId: string): Promise<string> {
  const ctx = await getTenantContext();
  const annee = await getAnneeDebut(anneeScolaireId);
  const prefix = `ENS-${annee}-`;
  const supabase = createClient();

  const { data: last, error } = await supabase
    .from('enseignant')
    .select('matricule')
    .eq('etablissementId', ctx.etablissementId)
    .like('matricule', `${prefix}%`)
    .order('matricule', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;

  const nextSeq = last ? parseInt(last.matricule.slice(prefix.length), 10) + 1 : 1;
  return `${prefix}${pad(nextSeq)}`;
}

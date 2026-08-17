import { createClient } from '@/lib/supabase/server';
import { getTenantContext } from './tenant';

export type TypeDocument = 'BULLETIN' | 'RECU' | 'RAPPORT';

const PREFIXES: Record<TypeDocument, string> = {
  BULLETIN: 'BUL',
  RECU: 'REC',
  RAPPORT: 'RAP',
};

function pad(n: number, width = 6): string {
  return String(n).padStart(width, '0');
}

/**
 * Numérotation par établissement × année scolaire × type.
 * Format: {PREFIX}-{YYYY}-{seq:06}. Année = année de début de l'année scolaire.
 *
 * NOTE: le max+1 lu ici n'est pas atomique. Sous forte concurrence, préférer
 * une séquence Postgres dédiée par (etablissement, annee, type) ou une
 * fonction RPC transactionnelle.
 */
export async function generateNumeroDocument(
  type: TypeDocument,
  anneeScolaireId: string,
): Promise<string> {
  const ctx = await getTenantContext();
  const supabase = createClient();

  const { data: annee, error: anneeError } = await supabase
    .from('annee_scolaire')
    .select('dateDebut')
    .eq('id', anneeScolaireId)
    .single();
  if (anneeError || !annee) throw new Error('AnneeScolaire introuvable');

  const year = new Date(annee.dateDebut).getUTCFullYear();
  const prefix = `${PREFIXES[type]}-${year}-`;

  const { data: last, error: lastError } = await supabase
    .from('document')
    .select('reference')
    .eq('etablissementId', ctx.etablissementId)
    .eq('type', type)
    .like('reference', `${prefix}%`)
    .order('reference', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastError) throw lastError;

  const nextSeq = last ? parseInt(last.reference.slice(prefix.length), 10) + 1 : 1;
  return `${prefix}${pad(nextSeq)}`;
}

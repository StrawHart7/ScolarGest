import { createClient } from '@/lib/supabase/server';
import { requireRole } from './authorization';
import { auditLog } from './audit';

export interface Classe {
  id: string;
  etablissementId: string;
  anneeScolaireId: string;
  niveauId: string;
  serieId: string | null;
  nom: string;
  capacite: number | null;
  createdAt: string;
  niveau: { nom: string; cycle: { nom: string } | null };
  serie: { nom: string } | null;
}

export interface CreateClasseInput {
  anneeScolaireId: string;
  niveauId: string;
  serieId?: string | null;
  nom: string;
  capacite?: number | null;
}

export async function listClasses(anneeScolaireId: string): Promise<Classe[]> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE');
  const supabase = createClient();
  const { data, error } = await supabase
    .from('classe')
    .select(
      'id, "etablissementId", "anneeScolaireId", "niveauId", "serieId", nom, capacite, "createdAt", niveau:niveau(nom, cycle:cycle(nom)), serie:serie(nom)',
    )
    .eq('etablissementId', ctx.etablissementId)
    .eq('anneeScolaireId', anneeScolaireId)
    .order('nom');
  if (error) throw error;
  return (data ?? []) as unknown as Classe[];
}

export async function getClasse(id: string): Promise<Classe> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE');
  const supabase = createClient();
  const { data, error } = await supabase
    .from('classe')
    .select(
      'id, "etablissementId", "anneeScolaireId", "niveauId", "serieId", nom, capacite, "createdAt", niveau:niveau(nom, cycle:cycle(nom)), serie:serie(nom)',
    )
    .eq('id', id)
    .eq('etablissementId', ctx.etablissementId)
    .single();
  if (error) throw error;
  return data as unknown as Classe;
}

export async function createClasse(input: CreateClasseInput): Promise<Classe> {
  const ctx = await requireRole('DIRECTEUR');
  const supabase = createClient();
  const { data, error } = await supabase
    .from('classe')
    .insert({
      etablissementId: ctx.etablissementId,
      anneeScolaireId: input.anneeScolaireId,
      niveauId: input.niveauId,
      serieId: input.serieId || null,
      nom: input.nom,
      capacite: input.capacite || null,
    })
    .select(
      'id, "etablissementId", "anneeScolaireId", "niveauId", "serieId", nom, capacite, "createdAt", niveau:niveau(nom, cycle:cycle(nom)), serie:serie(nom)',
    )
    .single();
  if (error) throw error;

  await auditLog({
    action: 'CREATE_CLASSE',
    module: 'structure',
    objetType: 'Classe',
    objetId: data.id,
    nouvelleValeur: { nom: input.nom },
  });

  return data as unknown as Classe;
}

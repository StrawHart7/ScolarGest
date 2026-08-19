import { createClient } from '@/lib/supabase/server';
import { requireRole } from './authorization';
import { auditLog } from './audit';

export interface AnneeScolaire {
  id: string;
  etablissementId: string;
  libelle: string;
  dateDebut: string;
  dateFin: string;
  statut: 'PREPARATION' | 'ACTIVE' | 'TERMINEE';
  createdAt: string;
}

export interface CreateAnneeScolaireInput {
  libelle: string;
  dateDebut: string;
  dateFin: string;
}

/**
 * Années scolaires de l'établissement. Ouverte à l'ENSEIGNANT : c'est un
 * catalogue interne sans donnée sensible, et tous ses écrans en dépendent
 * (mes classes, saisie des notes, rapports) — l'en exclure faisait échouer
 * l'espace enseignant en entier.
 */
export async function listAnneesScolaires(): Promise<AnneeScolaire[]> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE', 'ENSEIGNANT');
  const supabase = createClient();
  const { data, error } = await supabase
    .from('annee_scolaire')
    .select('id, "etablissementId", libelle, "dateDebut", "dateFin", statut, "createdAt"')
    .eq('etablissementId', ctx.etablissementId)
    .order('dateDebut', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getAnneeScolaire(id: string): Promise<AnneeScolaire> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE', 'ENSEIGNANT');
  const supabase = createClient();
  const { data, error } = await supabase
    .from('annee_scolaire')
    .select('id, "etablissementId", libelle, "dateDebut", "dateFin", statut, "createdAt"')
    .eq('id', id)
    .eq('etablissementId', ctx.etablissementId)
    .single();
  if (error) throw error;
  return data;
}

export async function createAnneeScolaire(input: CreateAnneeScolaireInput): Promise<AnneeScolaire> {
  const ctx = await requireRole('DIRECTEUR');
  const supabase = createClient();
  const { data, error } = await supabase
    .from('annee_scolaire')
    .insert({
      etablissementId: ctx.etablissementId,
      libelle: input.libelle,
      dateDebut: input.dateDebut,
      dateFin: input.dateFin,
    })
    .select('id, "etablissementId", libelle, "dateDebut", "dateFin", statut, "createdAt"')
    .single();
  if (error) throw error;

  await auditLog({
    action: 'CREATE_ANNEE_SCOLAIRE',
    module: 'structure',
    objetType: 'AnneeScolaire',
    objetId: data.id,
    nouvelleValeur: { libelle: input.libelle },
  });

  return data;
}

/**
 * Activates an année scolaire. The DB enforces at most one ACTIVE row per
 * établissement via a partial unique index, so the previous ACTIVE year is
 * flipped to TERMINEE first, in the same tenant scope.
 */
export async function activerAnneeScolaire(anneeScolaireId: string): Promise<void> {
  const ctx = await requireRole('DIRECTEUR');
  const supabase = createClient();

  const { error: closeError } = await supabase
    .from('annee_scolaire')
    .update({ statut: 'TERMINEE' })
    .eq('etablissementId', ctx.etablissementId)
    .eq('statut', 'ACTIVE');
  if (closeError) throw closeError;

  const { error: activateError } = await supabase
    .from('annee_scolaire')
    .update({ statut: 'ACTIVE' })
    .eq('id', anneeScolaireId)
    .eq('etablissementId', ctx.etablissementId);
  if (activateError) throw activateError;

  await auditLog({
    action: 'ACTIVER_ANNEE_SCOLAIRE',
    module: 'structure',
    objetType: 'AnneeScolaire',
    objetId: anneeScolaireId,
  });
}

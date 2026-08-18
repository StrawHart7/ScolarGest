import { createClient } from '@/lib/supabase/server';
import { requireRole } from './authorization';
import { auditLog } from './audit';
import { generateMatriculeEnseignant } from './matricule';
import { inviteUtilisateur } from './utilisateur';

export type StatutEnseignant = 'ACTIF' | 'INACTIF' | 'CONGE' | 'DEPART';
export type Sexe = 'M' | 'F';

export interface Enseignant {
  id: string;
  etablissementId: string;
  utilisateurId: string | null;
  matricule: string;
  ancienMatricule: string | null;
  nom: string;
  prenoms: string;
  sexe: Sexe;
  dateNaissance: string | null;
  telephone: string | null;
  email: string | null;
  adresse: string | null;
  dateEmbauche: string | null;
  statut: StatutEnseignant;
  createdAt: string;
}

export interface ListEnseignantsFilters {
  search?: string;
  statut?: StatutEnseignant;
}

export interface CreateEnseignantInput {
  nom: string;
  prenoms: string;
  sexe: Sexe;
  email: string;
  dateNaissance?: string;
  telephone?: string;
  adresse?: string;
  dateEmbauche?: string;
  ancienMatricule?: string;
  statut?: StatutEnseignant;
  anneeScolaireIdPourMatricule: string;
}

export interface UpdateEnseignantInput {
  nom?: string;
  prenoms?: string;
  sexe?: Sexe;
  dateNaissance?: string | null;
  telephone?: string | null;
  adresse?: string | null;
  dateEmbauche?: string | null;
  ancienMatricule?: string | null;
}

const ENSEIGNANT_FIELDS =
  'id, "etablissementId", "utilisateurId", matricule, "ancienMatricule", nom, prenoms, sexe, "dateNaissance", telephone, email, adresse, "dateEmbauche", statut, "createdAt"';

export async function listEnseignants(filters: ListEnseignantsFilters = {}): Promise<Enseignant[]> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'ENSEIGNANT');
  const supabase = createClient();
  let query = supabase
    .from('enseignant')
    .select(ENSEIGNANT_FIELDS)
    .eq('etablissementId', ctx.etablissementId)
    .order('nom');

  if (filters.statut) query = query.eq('statut', filters.statut);
  if (filters.search) {
    query = query.or(
      `nom.ilike.%${filters.search}%,prenoms.ilike.%${filters.search}%,matricule.ilike.%${filters.search}%`,
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as Enseignant[];
}

export async function getEnseignant(id: string): Promise<Enseignant> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'ENSEIGNANT');
  const supabase = createClient();
  const { data, error } = await supabase
    .from('enseignant')
    .select(ENSEIGNANT_FIELDS)
    .eq('id', id)
    .eq('etablissementId', ctx.etablissementId)
    .single();
  if (error) throw error;
  return data as unknown as Enseignant;
}

/**
 * Retrieves the `enseignant` row linked to the currently authenticated user
 * (role ENSEIGNANT). Used to scope "my classes/subjects" screens.
 */
export async function getEnseignantParUtilisateur(utilisateurId: string): Promise<Enseignant | null> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'ENSEIGNANT');
  const supabase = createClient();
  const { data, error } = await supabase
    .from('enseignant')
    .select(ENSEIGNANT_FIELDS)
    .eq('utilisateurId', utilisateurId)
    .eq('etablissementId', ctx.etablissementId)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as Enseignant) ?? null;
}

/**
 * Creates a teacher. Email + Supabase Auth invitation is required regardless
 * of the initial statut (décision produit, voir plan Phase 3) so a teacher
 * that later returns to ACTIF always has an account already provisioned.
 */
export async function createEnseignant(input: CreateEnseignantInput): Promise<string> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE');

  const matricule = await generateMatriculeEnseignant(input.anneeScolaireIdPourMatricule);

  const utilisateur = await inviteUtilisateur({
    email: input.email,
    nom: input.nom,
    prenom: input.prenoms,
    role: 'ENSEIGNANT',
    etablissementId: ctx.etablissementId,
  });

  const supabase = createClient();
  const { data, error } = await supabase
    .from('enseignant')
    .insert({
      etablissementId: ctx.etablissementId,
      utilisateurId: utilisateur.id,
      matricule,
      ancienMatricule: input.ancienMatricule ?? null,
      nom: input.nom,
      prenoms: input.prenoms,
      sexe: input.sexe,
      dateNaissance: input.dateNaissance ?? null,
      telephone: input.telephone ?? null,
      email: input.email,
      adresse: input.adresse ?? null,
      dateEmbauche: input.dateEmbauche ?? null,
      statut: input.statut ?? 'ACTIF',
    })
    .select('id')
    .single();
  if (error) throw error;

  await auditLog({
    action: 'CREATE_ENSEIGNANT',
    module: 'enseignants',
    objetType: 'Enseignant',
    objetId: data.id,
    nouvelleValeur: { matricule, nom: input.nom, prenoms: input.prenoms, email: input.email },
  });

  return data.id as string;
}

export async function updateEnseignant(id: string, input: UpdateEnseignantInput): Promise<void> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE');
  const supabase = createClient();
  const { error } = await supabase
    .from('enseignant')
    .update(input)
    .eq('id', id)
    .eq('etablissementId', ctx.etablissementId);
  if (error) throw error;

  await auditLog({
    action: 'UPDATE_ENSEIGNANT',
    module: 'enseignants',
    objetType: 'Enseignant',
    objetId: id,
    nouvelleValeur: input,
  });
}

/**
 * Never a hard delete. `statut` moves to INACTIF (leave of provisional nature)
 * or DEPART (definitive) — both keep affectations/titularités historized.
 */
export async function desactiverEnseignant(
  id: string,
  statut: 'INACTIF' | 'CONGE' | 'DEPART' = 'INACTIF',
): Promise<void> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE');
  const supabase = createClient();
  const { error } = await supabase
    .from('enseignant')
    .update({ statut })
    .eq('id', id)
    .eq('etablissementId', ctx.etablissementId);
  if (error) throw error;

  await auditLog({
    action: 'DESACTIVER_ENSEIGNANT',
    module: 'enseignants',
    objetType: 'Enseignant',
    objetId: id,
    nouvelleValeur: { statut },
  });
}

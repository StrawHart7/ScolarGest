import { createClient } from '@/lib/supabase/server';
import { requireRole } from './authorization';
import { auditLog } from './audit';
import { generateMatriculeEnseignant } from './matricule';
import { inviteUtilisateur, creerCompteSansEmail } from './utilisateur';

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
  /** L'adresse de l'enseignant. Absente quand `identifiant` est fourni. */
  email?: string;
  /**
   * Identifiant de connexion, pour un enseignant sans adresse email — le cas
   * de la majorité d'entre eux au Togo. Exclusif avec `email`.
   */
  identifiant?: string;
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

export interface EnseignantCree {
  id: string;
  /**
   * Présent uniquement quand le compte a été ouvert par identifiant. Montré
   * une seule fois : le directeur le recopie et le remet en main propre.
   */
  motDePasseProvisoire?: string;
  identifiant?: string;
}

/**
 * Crée un enseignant **et son compte**, quel que soit son statut initial
 * (décision produit, plan Phase 3) : un enseignant qui revient en ACTIF a
 * toujours un accès déjà provisionné.
 *
 * Deux façons d'ouvrir ce compte depuis le 2026-09-15. Par adresse email, avec
 * une invitation — le chemin autonome. Par **identifiant**, sans adresse : au
 * Togo, une bonne partie des enseignants n'a pas de boîte mail, ou en a une
 * qu'elle ne consulte jamais, et son compte n'était donc jamais activé. Le
 * directeur restait seul à saisir les notes de toute l'école, ce qui est
 * exactement ce que la plateforme devait lui éviter.
 *
 * `enseignant.email` reçoit l'adresse interne dans ce cas : c'est bien
 * l'adresse du compte, et les écrans l'affichent via `identifiantAffiche`.
 * Y mettre `null` priverait la liste des enseignants de tout identifiant
 * lisible.
 */
export async function createEnseignant(input: CreateEnseignantInput): Promise<EnseignantCree> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE');

  if (!input.email && !input.identifiant) {
    throw new Error('Indiquez une adresse email ou un identifiant de connexion.');
  }

  const matricule = await generateMatriculeEnseignant(input.anneeScolaireIdPourMatricule);

  // Le compte d'abord : s'il échoue — identifiant déjà pris, adresse refusée —
  // rien n'a été écrit. L'ordre inverse laisserait une fiche enseignant sans
  // accès, que personne ne saurait rattraper depuis l'écran.
  let utilisateurId: string;
  let emailCompte: string;
  let motDePasse: string | undefined;
  let identifiant: string | undefined;

  if (input.identifiant) {
    const cree = await creerCompteSansEmail({
      identifiant: input.identifiant,
      nom: input.nom,
      prenom: input.prenoms,
      role: 'ENSEIGNANT',
      etablissementId: ctx.etablissementId,
    });
    utilisateurId = cree.utilisateur.id;
    emailCompte = cree.utilisateur.email;
    motDePasse = cree.motDePasseProvisoire;
    identifiant = cree.identifiant;
  } else {
    const utilisateur = await inviteUtilisateur({
      email: input.email as string,
      nom: input.nom,
      prenom: input.prenoms,
      role: 'ENSEIGNANT',
      etablissementId: ctx.etablissementId,
    });
    utilisateurId = utilisateur.id;
    emailCompte = utilisateur.email;
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('enseignant')
    .insert({
      etablissementId: ctx.etablissementId,
      utilisateurId,
      matricule,
      ancienMatricule: input.ancienMatricule ?? null,
      nom: input.nom,
      prenoms: input.prenoms,
      sexe: input.sexe,
      dateNaissance: input.dateNaissance ?? null,
      telephone: input.telephone ?? null,
      email: emailCompte,
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
    nouvelleValeur: { matricule, nom: input.nom, prenoms: input.prenoms, email: emailCompte },
  });

  return { id: data.id as string, motDePasseProvisoire: motDePasse, identifiant };
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

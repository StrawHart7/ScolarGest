import { createClient } from '@/lib/supabase/server';
import { requireRole } from './authorization';
import { auditLog } from './audit';
import { generateMatriculeEleve } from './matricule';

export type StatutEleve = 'ACTIF' | 'INACTIF' | 'ARCHIVE' | 'TRANSFERE';
export type Sexe = 'M' | 'F';
export type TypeResponsable = 'PERE' | 'MERE' | 'TUTEUR' | 'AUTRE';

export interface Eleve {
  id: string;
  etablissementId: string;
  matricule: string;
  ancienMatricule: string | null;
  nom: string;
  prenoms: string;
  sexe: Sexe;
  dateNaissance: string;
  lieuNaissance: string | null;
  nationalite: string | null;
  statut: StatutEleve;
  createdAt: string;
}

export interface EleveAvecDetails extends Eleve {
  responsables: {
    id: string;
    lienParente: string;
    principal: boolean;
    responsable: {
      id: string;
      nom: string;
      prenoms: string;
      telephone: string | null;
      email: string | null;
      type: TypeResponsable;
    };
  }[];
  inscriptions: {
    id: string;
    anneeScolaireId: string;
    classeId: string;
    statut: string;
    decisionFinAnnee: string | null;
    dateInscription: string;
    classe: { nom: string };
    anneeScolaire: { libelle: string };
  }[];
}

export interface ListElevesFilters {
  search?: string;
  statut?: StatutEleve;
  classeId?: string;
  anneeScolaireId?: string;
}

export interface ResponsableInput {
  responsableId?: string; // lien vers responsable existant
  nom?: string;
  prenoms?: string;
  telephone?: string;
  email?: string;
  adresse?: string;
  profession?: string;
  type?: TypeResponsable;
  lienParente: string;
  principal?: boolean;
}

export interface CreateEleveInput {
  nom: string;
  prenoms: string;
  sexe: Sexe;
  dateNaissance: string;
  lieuNaissance?: string;
  nationalite?: string;
  ancienMatricule?: string;
  anneeScolaireIdPourMatricule: string;
  responsables: ResponsableInput[];
}

const ELEVE_FIELDS =
  'id, "etablissementId", matricule, "ancienMatricule", nom, prenoms, sexe, "dateNaissance", "lieuNaissance", nationalite, statut, "createdAt"';

export async function listEleves(filters: ListElevesFilters = {}): Promise<Eleve[]> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE');
  const supabase = createClient();
  let query = supabase
    .from('eleve')
    .select(ELEVE_FIELDS)
    .eq('etablissementId', ctx.etablissementId)
    .order('nom');

  if (filters.statut) query = query.eq('statut', filters.statut);
  if (filters.search) {
    query = query.or(`nom.ilike.%${filters.search}%,prenoms.ilike.%${filters.search}%,matricule.ilike.%${filters.search}%`);
  }

  if (filters.classeId || filters.anneeScolaireId) {
    const insQuery = supabase
      .from('inscription')
      .select('eleveId')
      .eq('etablissementId', ctx.etablissementId);
    if (filters.classeId) insQuery.eq('classeId', filters.classeId);
    if (filters.anneeScolaireId) insQuery.eq('anneeScolaireId', filters.anneeScolaireId);
    const { data: inscriptions, error: insError } = await insQuery;
    if (insError) throw insError;
    const ids = (inscriptions ?? []).map((i) => i.eleveId);
    if (ids.length === 0) return [];
    query = query.in('id', ids);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as Eleve[];
}

/**
 * Élèves ACTIVE (inscription) d'une classe pour une année scolaire. Ouvert à
 * ENSEIGNANT (contrairement à listEleves/getEleve) — consommé par les écrans
 * académiques en lecture/saisie (résultats, saisie des notes) qui leur sont
 * accessibles pour leurs classes affectées.
 */
export async function listElevesInscritsClasse(
  classeId: string,
  anneeScolaireId: string,
): Promise<Eleve[]> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'ENSEIGNANT');
  const supabase = createClient();

  const { data: inscriptions, error: insError } = await supabase
    .from('inscription')
    .select('eleveId')
    .eq('etablissementId', ctx.etablissementId)
    .eq('classeId', classeId)
    .eq('anneeScolaireId', anneeScolaireId)
    .eq('statut', 'ACTIVE');
  if (insError) throw insError;

  const ids = (inscriptions ?? []).map((i) => i.eleveId);
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('eleve')
    .select(ELEVE_FIELDS)
    .eq('etablissementId', ctx.etablissementId)
    .in('id', ids)
    .order('nom');
  if (error) throw error;
  return (data ?? []) as unknown as Eleve[];
}

export async function getEleve(id: string): Promise<EleveAvecDetails> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE');
  const supabase = createClient();

  const { data: eleve, error } = await supabase
    .from('eleve')
    .select(ELEVE_FIELDS)
    .eq('id', id)
    .eq('etablissementId', ctx.etablissementId)
    .single();
  if (error) throw error;

  const { data: responsables, error: respError } = await supabase
    .from('eleve_responsable')
    .select('id, "lienParente", principal, responsable:responsable(id, nom, prenoms, telephone, email, type)')
    .eq('eleveId', id);
  if (respError) throw respError;

  const { data: inscriptions, error: insError } = await supabase
    .from('inscription')
    .select(
      'id, "anneeScolaireId", "classeId", statut, "decisionFinAnnee", "dateInscription", classe:classe(nom), anneeScolaire:annee_scolaire(libelle)',
    )
    .eq('eleveId', id)
    .order('dateInscription', { ascending: false });
  if (insError) throw insError;

  return {
    ...(eleve as unknown as Eleve),
    responsables: (responsables ?? []) as unknown as EleveAvecDetails['responsables'],
    inscriptions: (inscriptions ?? []) as unknown as EleveAvecDetails['inscriptions'],
  };
}

export async function createEleveAvecResponsables(input: CreateEleveInput): Promise<string> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE');
  const supabase = createClient();

  const matricule = await generateMatriculeEleve(input.anneeScolaireIdPourMatricule);

  const { data, error } = await supabase.rpc('fn_creer_eleve_avec_responsables', {
    p_etablissement_id: ctx.etablissementId,
    p_eleve: {
      matricule,
      ancienMatricule: input.ancienMatricule ?? null,
      nom: input.nom,
      prenoms: input.prenoms,
      sexe: input.sexe,
      dateNaissance: input.dateNaissance,
      lieuNaissance: input.lieuNaissance ?? null,
      nationalite: input.nationalite ?? null,
    },
    p_responsables: input.responsables,
  });
  if (error) throw new Error(error.message);

  const eleveId = data as string;

  await auditLog({
    action: 'CREATE_ELEVE',
    module: 'eleves',
    objetType: 'Eleve',
    objetId: eleveId,
    nouvelleValeur: { matricule, nom: input.nom, prenoms: input.prenoms },
  });

  return eleveId;
}

export interface UpdateEleveInput {
  nom?: string;
  prenoms?: string;
  sexe?: Sexe;
  dateNaissance?: string;
  lieuNaissance?: string | null;
  nationalite?: string | null;
  ancienMatricule?: string | null;
}

export async function updateEleve(id: string, input: UpdateEleveInput): Promise<void> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE');
  const supabase = createClient();
  const { error } = await supabase
    .from('eleve')
    .update(input)
    .eq('id', id)
    .eq('etablissementId', ctx.etablissementId);
  if (error) throw error;

  await auditLog({
    action: 'UPDATE_ELEVE',
    module: 'eleves',
    objetType: 'Eleve',
    objetId: id,
    nouvelleValeur: input,
  });
}

export async function archiverEleve(id: string): Promise<void> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE');
  const supabase = createClient();
  const { error } = await supabase
    .from('eleve')
    .update({ statut: 'ARCHIVE' })
    .eq('id', id)
    .eq('etablissementId', ctx.etablissementId);
  if (error) throw error;

  await auditLog({
    action: 'ARCHIVE_ELEVE',
    module: 'eleves',
    objetType: 'Eleve',
    objetId: id,
  });
}

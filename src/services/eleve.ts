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
      adresse: string | null;
      profession: string | null;
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

/**
 * Caractères qui ont une signification dans la grammaire de filtres PostgREST
 * (`or=(...)`). Sans échappement, un élève cherché sous « Doe, John » casse la
 * requête — et, plus grave, un terme choisi laisse écrire des filtres
 * arbitraires dans la clause.
 */
function echapperMotifIlike(terme: string): string {
  return terme.replace(/[,()\\]/g, (c) => `\\${c}`);
}

/** Élève de liste, enrichi de sa classe courante pour l'affichage. */
export interface EleveListe extends Eleve {
  /** Classe de l'inscription ACTIVE, `null` si l'élève n'est pas inscrit. */
  classeNom: string | null;
}

export interface PageEleves {
  lignes: EleveListe[];
  total: number;
}

/**
 * Page d'élèves découpée **par la base** : `.range()` ne rapatrie que les
 * lignes affichées et `count: 'exact'` donne le total en une seule requête.
 *
 * La variante `listEleves` charge toute la table ; elle reste utilisée par les
 * écrans qui ont réellement besoin de l'ensemble (exports, sélecteurs). Pour
 * une liste paginée, elle faisait retélécharger l'établissement entier à
 * chaque clic sur « suivant ».
 */
export async function listElevesPage(
  filters: ListElevesFilters,
  pagination: { de: number; a: number; tri?: string; sens: 'asc' | 'desc' },
): Promise<PageEleves> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE');
  const supabase = createClient();

  let query = supabase
    .from('eleve')
    .select(ELEVE_FIELDS, { count: 'exact' })
    .eq('etablissementId', ctx.etablissementId);

  if (filters.statut) query = query.eq('statut', filters.statut);
  if (filters.search) {
    const terme = echapperMotifIlike(filters.search);
    query = query.or(
      `nom.ilike.%${terme}%,prenoms.ilike.%${terme}%,matricule.ilike.%${terme}%`,
    );
  }

  const croissant = pagination.sens !== 'desc';
  if (pagination.tri === 'statut') {
    query = query.order('statut', { ascending: croissant });
  }
  // Nom puis prénoms dans tous les cas : départage les homonymes et rend la
  // pagination déterministe, sans quoi une même ligne peut apparaître sur deux
  // pages successives.
  query = query
    .order('nom', { ascending: croissant })
    .order('prenoms', { ascending: croissant });

  const { data, error, count } = await query.range(pagination.de, pagination.a);
  if (error) throw error;

  const eleves = (data ?? []) as unknown as Eleve[];
  if (eleves.length === 0) return { lignes: [], total: count ?? 0 };

  // Classe courante en une seule requête pour la page affichée (dix lignes),
  // pas une par élève : la liste identifie un élève par son nom et sa classe,
  // et repartir chercher la classe ligne par ligne rendrait la page linéaire
  // en nombre d'élèves affichés.
  const { data: inscriptions, error: erreurInscriptions } = await supabase
    .from('inscription')
    .select('"eleveId", classe:classe("nom")')
    .eq('etablissementId', ctx.etablissementId)
    .eq('statut', 'ACTIVE')
    .in(
      'eleveId',
      eleves.map((eleve) => eleve.id),
    );
  if (erreurInscriptions) throw erreurInscriptions;

  const classeParEleve = new Map(
    (inscriptions ?? []).map((inscription) => [
      inscription.eleveId as string,
      // La jointure to-one `classe:classe("nom")` renvoie un objet (ou null) à
      // l'exécution, mais le typegen Supabase l'infère comme tableau : cast via
      // `unknown` pour lever l'incompatibilité sans changer le comportement.
      (inscription.classe as unknown as { nom: string } | null)?.nom ?? null,
    ]),
  );

  return {
    lignes: eleves.map((eleve) => ({
      ...eleve,
      classeNom: classeParEleve.get(eleve.id) ?? null,
    })),
    total: count ?? 0,
  };
}

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
    const terme = echapperMotifIlike(filters.search);
    query = query.or(`nom.ilike.%${terme}%,prenoms.ilike.%${terme}%,matricule.ilike.%${terme}%`);
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
    // Adresse et profession sont nécessaires au formulaire de modification
    // du responsable, désormais accessible depuis la fiche élève.
    .select(
      'id, "lienParente", principal, responsable:responsable(id, nom, prenoms, telephone, email, adresse, profession, type)',
    )
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

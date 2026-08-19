import { createClient } from '@/lib/supabase/server';
import { requireRole } from './authorization';
import { auditLog } from './audit';
import { getEnseignantParUtilisateur } from './enseignant';

export interface AffectationEnseignant {
  id: string;
  etablissementId: string;
  anneeScolaireId: string;
  enseignantId: string;
  classeId: string;
  matiereId: string;
  createdAt: string;
  classe: { nom: string };
  matiere: { nom: string };
  enseignant?: { nom: string; prenoms: string };
}

export interface CreerAffectationInput {
  anneeScolaireId: string;
  enseignantId: string;
  classeId: string;
  matiereId: string;
}

const AFFECTATION_FIELDS_CLASSE =
  'id, "etablissementId", "anneeScolaireId", "enseignantId", "classeId", "matiereId", "createdAt", matiere:matiere(nom), enseignant:enseignant(nom, prenoms)';

const AFFECTATION_FIELDS_ENSEIGNANT =
  'id, "etablissementId", "anneeScolaireId", "enseignantId", "classeId", "matiereId", "createdAt", classe:classe(nom), matiere:matiere(nom)';

/** Vue "qui enseigne quoi dans cette classe" (utilisée aussi par l'écran de titularité). */
export async function listAffectationsClasse(
  classeId: string,
  anneeScolaireId: string,
): Promise<AffectationEnseignant[]> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'ENSEIGNANT');
  const supabase = createClient();
  const { data, error } = await supabase
    .from('affectation_enseignant')
    .select(AFFECTATION_FIELDS_CLASSE)
    .eq('etablissementId', ctx.etablissementId)
    .eq('classeId', classeId)
    .eq('anneeScolaireId', anneeScolaireId);
  if (error) throw error;
  return (data ?? []) as unknown as AffectationEnseignant[];
}

/**
 * Vue "les affectations d'un enseignant donné". Quand l'appelant est lui-même
 * ENSEIGNANT, il ne peut consulter que ses propres affectations (périmètre
 * d'accès, Milestone 3) — vérifié en comparant `enseignant.utilisateurId` au
 * `ctx.userId` courant.
 */
export async function listAffectationsEnseignant(
  enseignantId: string,
  anneeScolaireId: string,
): Promise<AffectationEnseignant[]> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'ENSEIGNANT');
  const supabase = createClient();

  if (ctx.role === 'ENSEIGNANT') {
    const soi = await getEnseignantParUtilisateur(ctx.userId);
    if (!soi || soi.id !== enseignantId) {
      throw new Error('Accès refusé: hors de votre périmètre');
    }
  }

  const { data, error } = await supabase
    .from('affectation_enseignant')
    .select(AFFECTATION_FIELDS_ENSEIGNANT)
    .eq('etablissementId', ctx.etablissementId)
    .eq('enseignantId', enseignantId)
    .eq('anneeScolaireId', anneeScolaireId);
  if (error) throw error;
  return (data ?? []) as unknown as AffectationEnseignant[];
}

/** Raccourci pour l'espace enseignant connecté: ses propres affectations. */
export async function listMesAffectations(anneeScolaireId: string): Promise<AffectationEnseignant[]> {
  const ctx = await requireRole('ENSEIGNANT');
  const soi = await getEnseignantParUtilisateur(ctx.userId);
  if (!soi) return [];
  return listAffectationsEnseignant(soi.id, anneeScolaireId);
}

export async function creerAffectation(input: CreerAffectationInput): Promise<string> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE');
  const supabase = createClient();
  const { data, error } = await supabase
    .from('affectation_enseignant')
    .insert({
      etablissementId: ctx.etablissementId,
      anneeScolaireId: input.anneeScolaireId,
      enseignantId: input.enseignantId,
      classeId: input.classeId,
      matiereId: input.matiereId,
    })
    .select('id')
    .single();
  if (error) {
    if (error.code === '23505') {
      throw new Error('Cet enseignant est déjà affecté à cette classe pour cette matière.');
    }
    throw error;
  }

  await auditLog({
    action: 'CREER_AFFECTATION',
    module: 'enseignants',
    objetType: 'AffectationEnseignant',
    objetId: data.id,
    nouvelleValeur: input,
  });

  return data.id as string;
}

export async function supprimerAffectation(id: string): Promise<void> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE');
  const supabase = createClient();
  const { error } = await supabase
    .from('affectation_enseignant')
    .delete()
    .eq('id', id)
    .eq('etablissementId', ctx.etablissementId);
  if (error) throw error;

  await auditLog({
    action: 'SUPPRIMER_AFFECTATION',
    module: 'enseignants',
    objetType: 'AffectationEnseignant',
    objetId: id,
  });
}

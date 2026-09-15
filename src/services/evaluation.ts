import { createClient } from '@/lib/supabase/server';
import { requireRole } from './authorization';
import { auditLog } from './audit';
import { getEnseignantParUtilisateur } from './enseignant';

export type TypeEvaluation = 'INTERROGATION' | 'DEVOIR' | 'COMPOSITION';
export type Periode = 'TRIMESTRE_1' | 'TRIMESTRE_2' | 'TRIMESTRE_3';

export interface Evaluation {
  id: string;
  anneeScolaireId: string;
  classeId: string;
  matiereId: string;
  type: TypeEvaluation;
  periode: Periode;
  numero: number;
  date: string;
  createdAt: string;
}

export interface CreerEvaluationInput {
  anneeScolaireId: string;
  classeId: string;
  matiereId: string;
  type: TypeEvaluation;
  periode: Periode;
  /**
   * Déduit quand il est absent — et il l'est depuis le 2026-09-15, le
   * formulaire ne le demande plus. Voir `prochainNumero`. L'import le passe
   * encore explicitement, lui : un fichier porte ses propres numéros.
   */
  numero?: number;
  date: string;
}

const EVALUATION_FIELDS =
  'id, "anneeScolaireId", "classeId", "matiereId", type, periode, numero, date, "createdAt"';

/**
 * Vérifie que l'utilisateur ENSEIGNANT connecté est bien affecté à
 * (classeId, matiereId) pour cette année. Directeur/Secrétaire passent
 * toujours (périmètre large). Throw si hors périmètre.
 */
async function verifierPerimetreEnseignant(
  role: string,
  userId: string,
  etablissementId: string,
  classeId: string,
  matiereId: string,
  anneeScolaireId: string,
): Promise<void> {
  if (role !== 'ENSEIGNANT') return;
  const enseignant = await getEnseignantParUtilisateur(userId);
  if (!enseignant) throw new Error('Accès refusé: profil enseignant introuvable');

  const supabase = createClient();
  const { count, error } = await supabase
    .from('affectation_enseignant')
    .select('id', { count: 'exact', head: true })
    .eq('etablissementId', etablissementId)
    .eq('enseignantId', enseignant.id)
    .eq('classeId', classeId)
    .eq('matiereId', matiereId)
    .eq('anneeScolaireId', anneeScolaireId);
  if (error) throw error;
  if ((count ?? 0) === 0) {
    throw new Error('Accès refusé: vous n\'êtes pas affecté à cette classe pour cette matière');
  }
}

export async function listEvaluations(
  classeId: string,
  matiereId: string,
  periode: Periode,
): Promise<Evaluation[]> {
  await requireRole('DIRECTEUR', 'SECRETAIRE', 'ENSEIGNANT');
  const supabase = createClient();
  const { data, error } = await supabase
    .from('evaluation')
    .select(EVALUATION_FIELDS)
    .eq('classeId', classeId)
    .eq('matiereId', matiereId)
    .eq('periode', periode)
    .order('type')
    .order('numero');
  if (error) throw error;
  return (data ?? []) as unknown as Evaluation[];
}

/**
 * Crée une évaluation. Contrainte DB unique (classeId, matiereId, type,
 * periode, numero). Validation applicative: INTERROGATION → numero <= 3
 * (Docs/07 §5, au plus 3 interrogations par matière/période).
 */
/**
 * Le numéro suivant, pour ce couple classe × matière, ce type et cette période.
 *
 * ## Pourquoi il n'est plus saisi
 *
 * Le formulaire demandait « Numéro », avec un plafond de 3 sur les
 * interrogations. Les deux étaient faux.
 *
 * Le plafond, parce que le moteur divise par le **nombre** d'interrogations :
 * quatre donnent un résultat aussi cohérent que trois, et un professeur qui en
 * fait une quatrième n'avait aucun recours. Le numéro, parce qu'il
 * n'apparaît **nulle part** — ni sur le bulletin, ni dans le calcul des
 * moyennes, vérifié : `numero` n'est cité ni dans `calcul-moyennes` ni dans
 * aucun gabarit PDF. On demandait un renseignement à chaque saisie pour ne
 * jamais s'en servir.
 *
 * ## Une seule composition, un seul devoir par période
 *
 * « Composition du 1er trimestre » existe ; « composition 2 » n'existe pas dans
 * une école togolaise, le devoir non plus. Ces deux types reçoivent donc
 * toujours `1`, et **c'est la contrainte d'unicité de `0001` qui fait le
 * travail** — `(classeId, matiereId, type, periode, numero)`. Aucune migration,
 * aucune règle applicative à maintenir en double : la base refuse le doublon,
 * et le message ci-dessous le dit en français.
 *
 * Les interrogations, elles, s'incrémentent sans plafond.
 */
async function prochainNumero(
  classeId: string,
  matiereId: string,
  type: TypeEvaluation,
  periode: Periode,
): Promise<number> {
  if (type !== 'INTERROGATION') return 1;

  const supabase = createClient();
  const { data, error } = await supabase
    .from('evaluation')
    .select('numero')
    .eq('classeId', classeId)
    .eq('matiereId', matiereId)
    .eq('type', type)
    .eq('periode', periode)
    .order('numero', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;

  return ((data as { numero: number } | null)?.numero ?? 0) + 1;
}

export async function creerEvaluation(input: CreerEvaluationInput): Promise<string> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'ENSEIGNANT');

  await verifierPerimetreEnseignant(
    ctx.role,
    ctx.userId,
    ctx.etablissementId,
    input.classeId,
    input.matiereId,
    input.anneeScolaireId,
  );

  const numero =
    input.numero ??
    (await prochainNumero(input.classeId, input.matiereId, input.type, input.periode));

  const supabase = createClient();
  const { data, error } = await supabase
    .from('evaluation')
    .insert({
      anneeScolaireId: input.anneeScolaireId,
      classeId: input.classeId,
      matiereId: input.matiereId,
      type: input.type,
      periode: input.periode,
      numero,
      date: input.date,
    })
    .select('id')
    .single();
  if (error) {
    if (error.code === '23505') {
      // Le doublon ne peut plus venir que d'un second devoir ou d'une seconde
      // composition sur la même période : le numéro n'étant plus saisi, il n'y
      // a rien à corriger dans le formulaire. Le message doit donc dire ce qui
      // existe déjà, pas énumérer les colonnes d'une contrainte.
      if (input.type === 'COMPOSITION') {
        throw new Error(
          'Une composition existe déjà pour cette matière sur cette période. Il n’y en a qu’une par période.',
        );
      }
      if (input.type === 'DEVOIR') {
        throw new Error(
          'Un devoir existe déjà pour cette matière sur cette période. Il n’y en a qu’un par période.',
        );
      }
      throw new Error('Une évaluation identique existe déjà pour cette matière sur cette période.');
    }
    throw error;
  }

  await auditLog({
    action: 'CREER_EVALUATION',
    module: 'academique',
    objetType: 'Evaluation',
    objetId: data.id,
    nouvelleValeur: input,
  });

  return data.id as string;
}

/** Supprime une évaluation. Bloqué si des notes non-BROUILLON existent déjà. */
export async function supprimerEvaluation(id: string): Promise<void> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'ENSEIGNANT');
  const supabase = createClient();

  const { data: evaluation, error: evalError } = await supabase
    .from('evaluation')
    .select(EVALUATION_FIELDS)
    .eq('id', id)
    .single();
  if (evalError) throw evalError;

  await verifierPerimetreEnseignant(
    ctx.role,
    ctx.userId,
    ctx.etablissementId,
    evaluation.classeId,
    evaluation.matiereId,
    evaluation.anneeScolaireId,
  );

  const { count, error: countError } = await supabase
    .from('note')
    .select('id', { count: 'exact', head: true })
    .eq('evaluationId', id)
    .neq('statut', 'BROUILLON');
  if (countError) throw countError;
  if ((count ?? 0) > 0) {
    throw new Error('Impossible de supprimer cette évaluation : des notes ont déjà été soumises.');
  }

  const { error } = await supabase.from('evaluation').delete().eq('id', id);
  if (error) throw error;

  await auditLog({
    action: 'SUPPRIMER_EVALUATION',
    module: 'academique',
    objetType: 'Evaluation',
    objetId: id,
  });
}

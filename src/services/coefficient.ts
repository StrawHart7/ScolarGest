import { createClient } from '@/lib/supabase/server';
import { requireRole } from './authorization';
import { auditLog } from './audit';

export interface Coefficient {
  id: string;
  programmeEtablissementId: string;
  anneeScolaireId: string;
  serieId: string | null;
  coefficient: number;
}

const COEFFICIENT_FIELDS = 'id, "programmeEtablissementId", "anneeScolaireId", "serieId", coefficient';

/**
 * Coefficient actif pour un programme×année×série donné. `serieId` peut être
 * null (niveaux sans série, ex: collège) — la contrainte unique DB couvre
 * aussi ce cas via NULL.
 */
export async function getCoefficient(
  programmeEtablissementId: string,
  anneeScolaireId: string,
  serieId: string | null,
): Promise<Coefficient | null> {
  await requireRole('DIRECTEUR', 'SECRETAIRE', 'ENSEIGNANT');
  const supabase = createClient();
  let query = supabase
    .from('coefficient_matiere')
    .select(COEFFICIENT_FIELDS)
    .eq('programmeEtablissementId', programmeEtablissementId)
    .eq('anneeScolaireId', anneeScolaireId);
  query = serieId === null ? query.is('serieId', null) : query.eq('serieId', serieId);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return (data as unknown as Coefficient) ?? null;
}

/**
 * Upsert historisé : une ligne par (programmeEtablissementId, anneeScolaireId,
 * serieId). Même année → update en place (pas de doublon). Nouvelle année →
 * nouvelle ligne, le passé n'est jamais modifié.
 */
export async function definirCoefficient(
  programmeEtablissementId: string,
  anneeScolaireId: string,
  serieId: string | null,
  coefficient: number,
): Promise<Coefficient> {
  await requireRole('DIRECTEUR', 'SECRETAIRE');
  const supabase = createClient();

  const existing = await getCoefficient(programmeEtablissementId, anneeScolaireId, serieId);

  if (existing) {
    const { data, error } = await supabase
      .from('coefficient_matiere')
      .update({ coefficient })
      .eq('id', existing.id)
      .select(COEFFICIENT_FIELDS)
      .single();
    if (error) throw error;

    await auditLog({
      action: 'DEFINIR_COEFFICIENT',
      module: 'academique',
      objetType: 'CoefficientMatiere',
      objetId: existing.id,
      ancienneValeur: { coefficient: existing.coefficient },
      nouvelleValeur: { coefficient },
    });

    return data as unknown as Coefficient;
  }

  const { data, error } = await supabase
    .from('coefficient_matiere')
    .insert({
      programmeEtablissementId,
      anneeScolaireId,
      serieId,
      coefficient,
    })
    .select(COEFFICIENT_FIELDS)
    .single();
  if (error) throw error;

  await auditLog({
    action: 'DEFINIR_COEFFICIENT',
    module: 'academique',
    objetType: 'CoefficientMatiere',
    objetId: data.id,
    nouvelleValeur: { programmeEtablissementId, anneeScolaireId, serieId, coefficient },
  });

  return data as unknown as Coefficient;
}

export interface CoefficientSaisi {
  programmeEtablissementId: string;
  coefficient: number;
}

/**
 * Enregistre les coefficients d'un niveau (et d'une série) en une fois.
 *
 * L'écran proposait un bouton « Enregistrer » par matière : définir un
 * programme de douze matières demandait douze allers-retours, et rien ne
 * garantissait que l'ensemble soit cohérent à un instant donné. On lit l'état
 * existant en une requête, puis on n'écrit que ce qui change réellement.
 */
export async function definirCoefficients(
  anneeScolaireId: string,
  serieId: string | null,
  saisies: CoefficientSaisi[],
): Promise<number> {
  await requireRole('DIRECTEUR', 'SECRETAIRE');
  if (saisies.length === 0) return 0;
  const supabase = createClient();

  let lecture = supabase
    .from('coefficient_matiere')
    .select(COEFFICIENT_FIELDS)
    .eq('anneeScolaireId', anneeScolaireId)
    .in(
      'programmeEtablissementId',
      saisies.map((s) => s.programmeEtablissementId),
    );
  lecture = serieId === null ? lecture.is('serieId', null) : lecture.eq('serieId', serieId);
  const { data: existants, error: lectureError } = await lecture;
  if (lectureError) throw lectureError;

  const parProgramme = new Map(
    ((existants ?? []) as unknown as Coefficient[]).map((c) => [c.programmeEtablissementId, c]),
  );

  const aInserer: {
    programmeEtablissementId: string;
    anneeScolaireId: string;
    serieId: string | null;
    coefficient: number;
  }[] = [];
  const aMettreAJour: { id: string; ancien: number; nouveau: number }[] = [];

  for (const saisie of saisies) {
    const existant = parProgramme.get(saisie.programmeEtablissementId);
    if (!existant) {
      aInserer.push({
        programmeEtablissementId: saisie.programmeEtablissementId,
        anneeScolaireId,
        serieId,
        coefficient: saisie.coefficient,
      });
    } else if (Number(existant.coefficient) !== saisie.coefficient) {
      aMettreAJour.push({
        id: existant.id,
        ancien: Number(existant.coefficient),
        nouveau: saisie.coefficient,
      });
    }
  }

  if (aInserer.length > 0) {
    const { error } = await supabase.from('coefficient_matiere').insert(aInserer);
    if (error) throw error;
  }
  for (const modification of aMettreAJour) {
    const { error } = await supabase
      .from('coefficient_matiere')
      .update({ coefficient: modification.nouveau })
      .eq('id', modification.id);
    if (error) throw error;
  }

  const nombreModifie = aInserer.length + aMettreAJour.length;
  if (nombreModifie > 0) {
    await auditLog({
      action: 'DEFINIR_COEFFICIENTS',
      module: 'academique',
      objetType: 'CoefficientMatiere',
      objetId: anneeScolaireId,
      ancienneValeur: { modifications: aMettreAJour.map((m) => m.ancien) },
      nouvelleValeur: {
        serieId,
        crees: aInserer.length,
        modifies: aMettreAJour.length,
      },
    });
  }

  return nombreModifie;
}

/**
 * Coefficients d'un lot de programmes pour une année et une série, en une
 * requête — remplace un `getCoefficient()` par matière à l'affichage.
 */
export async function listCoefficients(
  programmeIds: string[],
  anneeScolaireId: string,
  serieId: string | null,
): Promise<Map<string, number>> {
  await requireRole('DIRECTEUR', 'SECRETAIRE', 'ENSEIGNANT');
  if (programmeIds.length === 0) return new Map();
  const supabase = createClient();

  let requete = supabase
    .from('coefficient_matiere')
    .select('"programmeEtablissementId", coefficient')
    .eq('anneeScolaireId', anneeScolaireId)
    .in('programmeEtablissementId', programmeIds);
  requete = serieId === null ? requete.is('serieId', null) : requete.eq('serieId', serieId);

  const { data, error } = await requete;
  if (error) throw error;
  return new Map(
    ((data ?? []) as { programmeEtablissementId: string; coefficient: number }[]).map((c) => [
      c.programmeEtablissementId,
      Number(c.coefficient),
    ]),
  );
}

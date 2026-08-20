import { createClient } from '@/lib/supabase/server';
import { requireRole } from './authorization';
import { listProgramme } from './programme';
import { getCoefficient } from './coefficient';
import { listAffectationsClasse } from './affectation';
import { getClassementClasse, getMoyennesEleve } from './note';
import type { Periode } from './evaluation';
import {
  moyenneInterros,
  moyenneClasse,
  moyenneMatiere,
  moyenneTrimestrielle,
  moyenneAnnuelle,
  appreciation,
  classement,
  type RankingEntry,
} from '@/modules/academics/services/calcul-moyennes';

/**
 * Orchestrateur pur-lecture dédié au bulletin: calcule le détail complet par
 * matière (composantes intermédiaires, rang matière, professeur) en plus de
 * la synthèse. Séparé de `note.ts` (voir plan Phase 5) car `getMoyennesEleve`
 * n'expose que la moyenne finale par matière — étendre son usage existant
 * (saisie/validation des notes) au risque de le complexifier n'est pas
 * souhaitable. Aucun calcul arithmétique n'est réimplémenté ici: tout passe
 * par les fonctions pures de `calcul-moyennes.ts`.
 */

export interface MatiereBulletinDetail {
  matiereId: string;
  matiereNom: string;
  obligatoire: boolean;
  coefficient: number;
  moyInterros: number | null;
  devoir: number | null;
  moyClasse: number | null;
  composition: number | null;
  moyenneFinale: number | null;
  rangMatiere: number | null;
  professeurs: string;
}

export interface SyntheseBulletin {
  moyenneTrimestrielle: number | null;
  appreciation: string | null;
  rangGeneral: number | null;
  effectifClasse: number;
  meilleureMoyenneClasse: number | null;
  plusFaibleMoyenneClasse: number | null;
  /** Moyenne générale de la classe — figure sur le bulletin officiel. */
  moyenneGeneraleClasse: number | null;
  moyenneAnnuelle: number | null;
}

export interface DonneesBulletin {
  eleveId: string;
  classeId: string;
  periode: Periode;
  anneeScolaireId: string;
  matieres: MatiereBulletinDetail[];
  synthese: SyntheseBulletin;
}

interface EvaluationRow {
  id: string;
  matiereId: string;
  type: 'INTERROGATION' | 'DEVOIR' | 'COMPOSITION';
}

interface NoteRow {
  evaluationId: string;
  eleveId: string;
  valeur: number | null;
  statut: string;
}

/** Valeur "effective" d'une note: BROUILLON n'est pas encore officielle. */
function valeurEffective(n: { statut: string; valeur: number | null }): number | null {
  if (n.statut === 'BROUILLON') return null;
  return n.valeur;
}

function calculerMoyenneMatiere(
  eleveId: string,
  evaluations: EvaluationRow[],
  notesByEvaluation: Map<string, Map<string, number | null>>,
): {
  moyInterros: number | null;
  devoir: number | null;
  moyClasse: number | null;
  composition: number | null;
  moyenneFinale: number | null;
} {
  const interros = evaluations
    .filter((e) => e.type === 'INTERROGATION')
    .map((e) => notesByEvaluation.get(e.id)?.get(eleveId))
    .filter((v): v is number => v !== null && v !== undefined);

  const devoirEval = evaluations.find((e) => e.type === 'DEVOIR');
  const devoir = devoirEval ? notesByEvaluation.get(devoirEval.id)?.get(eleveId) ?? null : null;

  const compositionEval = evaluations.find((e) => e.type === 'COMPOSITION');
  const composition = compositionEval
    ? notesByEvaluation.get(compositionEval.id)?.get(eleveId) ?? null
    : null;

  const moyInterros = moyenneInterros(interros);
  const moyClasse = moyenneClasse(moyInterros, devoir);
  const moyenneFinale = moyenneMatiere(moyClasse, composition);

  return { moyInterros, devoir, moyClasse, composition, moyenneFinale };
}

/**
 * Détail complet par matière + synthèse pour le bulletin d'un élève.
 * Réservé Directeur/Secrétaire (génération de document officiel).
 */
export async function getDonneesBulletin(
  eleveId: string,
  classeId: string,
  periode: Periode,
  anneeScolaireId: string,
): Promise<DonneesBulletin> {
  await requireRole('DIRECTEUR', 'SECRETAIRE');
  const supabase = createClient();

  const { data: classe, error: classeError } = await supabase
    .from('classe')
    .select('id, "niveauId", "serieId"')
    .eq('id', classeId)
    .single();
  if (classeError) throw classeError;

  const { data: inscriptions, error: insError } = await supabase
    .from('inscription')
    .select('"eleveId"')
    .eq('classeId', classeId)
    .eq('anneeScolaireId', anneeScolaireId)
    .eq('statut', 'ACTIVE');
  if (insError) throw insError;
  const eleveIds = (inscriptions ?? []).map((i: { eleveId: string }) => i.eleveId);
  const effectifClasse = eleveIds.length;

  const programme = await listProgramme(classe.niveauId);
  const affectations = await listAffectationsClasse(classeId, anneeScolaireId);

  const { data: evaluations, error: evalError } = await supabase
    .from('evaluation')
    .select('id, "matiereId", type')
    .eq('classeId', classeId)
    .eq('periode', periode);
  if (evalError) throw evalError;
  const evaluationRows = (evaluations ?? []) as EvaluationRow[];
  const evaluationIds = evaluationRows.map((e) => e.id);

  // notesByEvaluation: evaluationId -> (eleveId -> valeur effective)
  const notesByEvaluation = new Map<string, Map<string, number | null>>();
  if (evaluationIds.length > 0 && eleveIds.length > 0) {
    const { data: notes, error: notesError } = await supabase
      .from('note')
      .select('"evaluationId", "eleveId", valeur, statut')
      .in('evaluationId', evaluationIds)
      .in('eleveId', eleveIds);
    if (notesError) throw notesError;
    for (const n of (notes ?? []) as NoteRow[]) {
      if (!notesByEvaluation.has(n.evaluationId)) {
        notesByEvaluation.set(n.evaluationId, new Map());
      }
      notesByEvaluation.get(n.evaluationId)!.set(n.eleveId, valeurEffective(n));
    }
  }

  const matieres: MatiereBulletinDetail[] = [];
  const matiereInputsPourTrimestre: { moyenne: number | null; coefficient: number; obligatoire: boolean }[] = [];

  for (const item of programme) {
    const matiereEvaluations = evaluationRows.filter((e) => e.matiereId === item.matiereId);

    const coef = await getCoefficient(item.id, anneeScolaireId, classe.serieId ?? null);
    const coefficient = coef?.coefficient ?? 0;

    const eleveDetail = calculerMoyenneMatiere(eleveId, matiereEvaluations, notesByEvaluation);

    // Rang matière: moyenne finale de tous les élèves actifs de la classe pour cette matière.
    const ranking: RankingEntry[] = eleveIds.map((id) => ({
      id,
      moyenne: calculerMoyenneMatiere(id, matiereEvaluations, notesByEvaluation).moyenneFinale,
    }));
    const ranked = classement(ranking);
    const rangMatiere = ranked.find((r) => r.id === eleveId)?.rang ?? null;

    const professeurs = affectations
      .filter((a) => a.matiereId === item.matiereId)
      .map((a) => (a.enseignant ? `${a.enseignant.prenoms} ${a.enseignant.nom}` : ''))
      .filter((v) => v.length > 0)
      .join(', ');

    matieres.push({
      matiereId: item.matiereId,
      matiereNom: item.matiere.nom,
      obligatoire: item.obligatoire,
      coefficient,
      moyInterros: eleveDetail.moyInterros,
      devoir: eleveDetail.devoir,
      moyClasse: eleveDetail.moyClasse,
      composition: eleveDetail.composition,
      moyenneFinale: eleveDetail.moyenneFinale,
      rangMatiere,
      professeurs,
    });

    matiereInputsPourTrimestre.push({
      moyenne: eleveDetail.moyenneFinale,
      coefficient,
      obligatoire: item.obligatoire,
    });
  }

  const moyTrim = moyenneTrimestrielle(matiereInputsPourTrimestre);

  const classementClasse = await getClassementClasse(classeId, periode, anneeScolaireId);
  const rangGeneral = classementClasse.find((c) => c.eleveId === eleveId)?.rang ?? null;
  const moyennesClasse = classementClasse
    .map((c) => c.moyenneTrimestrielle)
    .filter((v): v is number => v !== null);
  const meilleureMoyenneClasse = moyennesClasse.length > 0 ? Math.max(...moyennesClasse) : null;
  const plusFaibleMoyenneClasse = moyennesClasse.length > 0 ? Math.min(...moyennesClasse) : null;
  const moyenneGeneraleClasse =
    moyennesClasse.length > 0
      ? Number((moyennesClasse.reduce((s, m) => s + m, 0) / moyennesClasse.length).toFixed(2))
      : null;

  // Moyenne annuelle: uniquement si les 3 trimestres ont des données (best effort,
  // ne bloque jamais la génération d'un bulletin trimestriel).
  let moyAnnuelle: number | null = null;
  try {
    const periodes: Periode[] = ['TRIMESTRE_1', 'TRIMESTRE_2', 'TRIMESTRE_3'];
    const resultats = await Promise.all(
      periodes.map((p) => getMoyennesEleve(eleveId, classeId, p, anneeScolaireId)),
    );
    const [t1, t2, t3] = resultats.map((r) => r.moyenneTrimestrielle);
    moyAnnuelle = moyenneAnnuelle(t1 ?? null, t2 ?? null, t3 ?? null);
  } catch {
    moyAnnuelle = null;
  }

  return {
    eleveId,
    classeId,
    periode,
    anneeScolaireId,
    matieres,
    synthese: {
      moyenneTrimestrielle: moyTrim,
      appreciation: moyTrim === null ? null : appreciation(moyTrim),
      rangGeneral,
      effectifClasse,
      meilleureMoyenneClasse,
      plusFaibleMoyenneClasse,
      moyenneGeneraleClasse,
      moyenneAnnuelle: moyAnnuelle,
    },
  };
}

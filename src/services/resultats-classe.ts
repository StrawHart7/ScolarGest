import { createClient } from '@/lib/supabase/server';
import { requireRole } from './authorization';
import { getEnseignantParUtilisateur } from './enseignant';
import { listProgramme } from './programme';
import type { Periode } from './evaluation';
import {
  moyenneInterros,
  moyenneClasse,
  moyenneMatiere,
  moyenneTrimestrielle,
  appreciation,
  classement,
  type RankingEntry,
} from '@/modules/academics/services/calcul-moyennes';

/**
 * Résultats complets d'une classe en **lecture groupée**.
 *
 * L'écran « Moyennes & classement » enchaînait `getClassementClasse()` (qui
 * appelle `getMoyennesEleve()` en série, une fois par élève) puis un second
 * `getMoyennesEleve()` par élève pour l'affichage — chacun rechargeant la
 * classe, le programme, les évaluations, et un `getCoefficient()` par matière.
 * Sur une classe de 18 élèves et 10 matières cela représentait plusieurs
 * centaines d'aller-retours vers une base distante : la page ne s'affichait
 * jamais.
 *
 * Ici, tout est chargé en 5 requêtes, quelle que soit la taille de la classe,
 * et tout le calcul est délégué au moteur pur `calcul-moyennes.ts`.
 */

export interface MoyenneMatiereEleve {
  matiereId: string;
  matiereNom: string;
  obligatoire: boolean;
  coefficient: number;
  moyenne: number | null;
}

export interface ResultatEleve {
  eleveId: string;
  matricule: string;
  nom: string;
  prenoms: string;
  matieres: MoyenneMatiereEleve[];
  moyenneTrimestrielle: number | null;
  appreciation: string | null;
  rang: number | null;
}

export interface ResultatsClasse {
  /** En-têtes de colonnes : le programme du niveau, identique pour la classe. */
  matieres: { matiereId: string; matiereNom: string }[];
  eleves: ResultatEleve[];
  moyenneGenerale: number | null;
  moyenneLaPlusForte: number | null;
  moyenneLaPlusFaible: number | null;
}

interface EvaluationLegere {
  id: string;
  matiereId: string;
  type: 'INTERROGATION' | 'DEVOIR' | 'COMPOSITION';
}

/**
 * Un enseignant ne doit voir que les classes qui lui sont affectées.
 * `getClassementClasse` ne vérifiait que le rôle, ce qui laissait n'importe
 * quel enseignant lire le classement de n'importe quelle classe en changeant
 * l'identifiant dans l'URL.
 */
async function verifierPerimetre(
  role: string,
  utilisateurId: string,
  etablissementId: string,
  classeId: string,
  anneeScolaireId: string,
): Promise<void> {
  if (role !== 'ENSEIGNANT') return;
  const enseignant = await getEnseignantParUtilisateur(utilisateurId);
  if (!enseignant) {
    throw new Error("Accès refusé : aucun profil enseignant n'est rattaché à ce compte.");
  }
  const supabase = createClient();
  const { data, error } = await supabase
    .from('affectation_enseignant')
    .select('id')
    .eq('etablissementId', etablissementId)
    .eq('enseignantId', enseignant.id)
    .eq('classeId', classeId)
    .eq('anneeScolaireId', anneeScolaireId)
    .limit(1);
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error('Accès refusé : cette classe ne fait pas partie de vos affectations.');
  }
}

export async function getResultatsClasse(
  classeId: string,
  periode: Periode,
  anneeScolaireId: string,
): Promise<ResultatsClasse> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'ENSEIGNANT');
  await verifierPerimetre(ctx.role, ctx.userId, ctx.etablissementId, classeId, anneeScolaireId);

  const supabase = createClient();

  // 1. La classe (pour le niveau et la série, qui déterminent programme et coefficients).
  const { data: classe, error: classeError } = await supabase
    .from('classe')
    .select('id, "niveauId", "serieId"')
    .eq('id', classeId)
    .eq('etablissementId', ctx.etablissementId)
    .single();
  if (classeError) throw classeError;

  // 2. Les élèves inscrits + 3. le programme du niveau + 4. les évaluations de la période.
  const [inscriptionsResultat, programme, evaluationsResultat] = await Promise.all([
    supabase
      .from('inscription')
      .select('"eleveId", eleve:eleve(id, matricule, nom, prenoms)')
      .eq('classeId', classeId)
      .eq('anneeScolaireId', anneeScolaireId)
      .eq('statut', 'ACTIVE'),
    listProgramme(classe.niveauId),
    supabase
      .from('evaluation')
      .select('id, "matiereId", type')
      .eq('classeId', classeId)
      .eq('periode', periode),
  ]);
  if (inscriptionsResultat.error) throw inscriptionsResultat.error;
  if (evaluationsResultat.error) throw evaluationsResultat.error;

  const eleves = ((inscriptionsResultat.data ?? []) as unknown as {
    eleve: { id: string; matricule: string; nom: string; prenoms: string } | null;
  }[])
    .map((i) => i.eleve)
    .filter((e): e is { id: string; matricule: string; nom: string; prenoms: string } => Boolean(e))
    .sort((a, b) => `${a.nom} ${a.prenoms}`.localeCompare(`${b.nom} ${b.prenoms}`, 'fr'));

  const evaluations = (evaluationsResultat.data ?? []) as unknown as EvaluationLegere[];

  // 5. Les coefficients de l'année pour la série de la classe, en une requête
  //    au lieu d'un `getCoefficient()` par matière et par élève.
  const requeteCoefficients = supabase
    .from('coefficient_matiere')
    .select('"programmeEtablissementId", coefficient')
    .eq('anneeScolaireId', anneeScolaireId)
    .in(
      'programmeEtablissementId',
      programme.map((p) => p.id),
    );
  const { data: coefficients, error: coefficientsError } = await (classe.serieId
    ? requeteCoefficients.eq('serieId', classe.serieId)
    : requeteCoefficients.is('serieId', null));
  if (coefficientsError) throw coefficientsError;

  const coefficientParProgramme = new Map(
    ((coefficients ?? []) as { programmeEtablissementId: string; coefficient: number }[]).map(
      (c) => [c.programmeEtablissementId, Number(c.coefficient)],
    ),
  );

  // 6. Toutes les notes de la classe pour la période, en une requête.
  //    evaluationId -> eleveId -> valeur officielle (une note BROUILLON n'est
  //    pas encore officielle, même règle que le bulletin).
  const notesParEvaluation = new Map<string, Map<string, number | null>>();
  if (evaluations.length > 0 && eleves.length > 0) {
    const { data: notes, error: notesError } = await supabase
      .from('note')
      .select('"evaluationId", "eleveId", valeur, statut')
      .in(
        'evaluationId',
        evaluations.map((e) => e.id),
      )
      .in(
        'eleveId',
        eleves.map((e) => e.id),
      );
    if (notesError) throw notesError;
    for (const note of (notes ?? []) as unknown as {
      evaluationId: string;
      eleveId: string;
      valeur: number | null;
      statut: string;
    }[]) {
      let parEleve = notesParEvaluation.get(note.evaluationId);
      if (!parEleve) {
        parEleve = new Map();
        notesParEvaluation.set(note.evaluationId, parEleve);
      }
      // Seule une note VALIDE (ou dérivée d'une VALIDE : EN_ATTENTE/REJETE)
      // est officielle. BROUILLON et SOUMISE (en attente de validation par
      // la Secrétaire) ne comptent pas — même règle que `valeurEffective()`
      // dans note.ts.
      const compte = note.statut === 'VALIDE' || note.statut === 'EN_ATTENTE' || note.statut === 'REJETE';
      parEleve.set(note.eleveId, compte ? note.valeur : null);
    }
  }

  const evaluationsParMatiere = new Map<string, EvaluationLegere[]>();
  for (const evaluation of evaluations) {
    const liste = evaluationsParMatiere.get(evaluation.matiereId);
    if (liste) liste.push(evaluation);
    else evaluationsParMatiere.set(evaluation.matiereId, [evaluation]);
  }

  const noteDe = (evaluationId: string, eleveId: string): number | null =>
    notesParEvaluation.get(evaluationId)?.get(eleveId) ?? null;

  const resultatsBruts = eleves.map((eleve) => {
    const matieres: MoyenneMatiereEleve[] = programme.map((item) => {
      const evaluationsMatiere = evaluationsParMatiere.get(item.matiereId) ?? [];
      const interros = evaluationsMatiere
        .filter((e) => e.type === 'INTERROGATION')
        .map((e) => noteDe(e.id, eleve.id))
        .filter((v): v is number => v !== null);
      const devoirEvaluation = evaluationsMatiere.find((e) => e.type === 'DEVOIR');
      const compositionEvaluation = evaluationsMatiere.find((e) => e.type === 'COMPOSITION');

      const devoir = devoirEvaluation ? noteDe(devoirEvaluation.id, eleve.id) : null;
      const composition = compositionEvaluation
        ? noteDe(compositionEvaluation.id, eleve.id)
        : null;

      return {
        matiereId: item.matiereId,
        matiereNom: item.matiere.nom,
        obligatoire: item.obligatoire,
        coefficient: coefficientParProgramme.get(item.id) ?? 0,
        moyenne: moyenneMatiere(moyenneClasse(moyenneInterros(interros), devoir), composition),
      };
    });

    const moyenne = moyenneTrimestrielle(
      matieres.map((m) => ({
        moyenne: m.moyenne,
        coefficient: m.coefficient,
        obligatoire: m.obligatoire,
      })),
    );

    return { eleve, matieres, moyenne };
  });

  const ranking: RankingEntry[] = resultatsBruts.map((r) => ({
    id: r.eleve.id,
    moyenne: r.moyenne,
  }));
  const rangParEleve = new Map(classement(ranking).map((r) => [r.id, r.rang]));

  const valeurs = resultatsBruts
    .map((r) => r.moyenne)
    .filter((m): m is number => m !== null);

  return {
    matieres: programme.map((item) => ({
      matiereId: item.matiereId,
      matiereNom: item.matiere.nom,
    })),
    eleves: resultatsBruts.map((r) => ({
      eleveId: r.eleve.id,
      matricule: r.eleve.matricule,
      nom: r.eleve.nom,
      prenoms: r.eleve.prenoms,
      matieres: r.matieres,
      moyenneTrimestrielle: r.moyenne,
      appreciation: r.moyenne === null ? null : appreciation(r.moyenne),
      rang: rangParEleve.get(r.eleve.id) ?? null,
    })),
    moyenneGenerale:
      valeurs.length > 0
        ? Number((valeurs.reduce((somme, m) => somme + m, 0) / valeurs.length).toFixed(2))
        : null,
    moyenneLaPlusForte: valeurs.length > 0 ? Math.max(...valeurs) : null,
    moyenneLaPlusFaible: valeurs.length > 0 ? Math.min(...valeurs) : null,
  };
}

import { createClient } from '@/lib/supabase/server';
import { requireRole } from './authorization';
import { auditLog } from './audit';
import { getEnseignantParUtilisateur } from './enseignant';
import { verifyPin } from './pin';
import { listProgramme } from './programme';
import { getCoefficient } from './coefficient';
import { getResultatsClasse } from './resultats-classe';
import type { Periode } from './evaluation';
import {
  moyenneInterros,
  moyenneClasse,
  moyenneMatiere,
  moyenneTrimestrielle,
  appreciation,
} from '@/modules/academics/services/calcul-moyennes';

export type StatutNote = 'BROUILLON' | 'SOUMISE' | 'EN_ATTENTE' | 'VALIDE' | 'REJETE';

export interface Note {
  id: string;
  evaluationId: string;
  eleveId: string;
  valeur: number | null;
  valeurProposee: number | null;
  observation: string | null;
  demandePar: string | null;
  statut: StatutNote;
  createdAt: string;
  updatedAt: string;
}

const NOTE_FIELDS =
  'id, "evaluationId", "eleveId", valeur, "valeurProposee", observation, "demandePar", statut, "createdAt", "updatedAt"';

interface EvaluationRow {
  id: string;
  anneeScolaireId: string;
  classeId: string;
  matiereId: string;
  type: 'INTERROGATION' | 'DEVOIR' | 'COMPOSITION';
  periode: Periode;
  numero: number;
}

async function getEvaluation(id: string): Promise<EvaluationRow> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('evaluation')
    .select('id, "anneeScolaireId", "classeId", "matiereId", type, periode, numero')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as unknown as EvaluationRow;
}

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
    throw new Error("Accès refusé: vous n'êtes pas affecté à cette classe pour cette matière");
  }
}

/**
 * Notes d'une évaluation. Enseignant: uniquement s'il a l'affectation
 * correspondante. Secrétaire/Directeur: accès large lecture (tenant-scoped
 * via la classe de l'évaluation).
 */
export async function listNotesEvaluation(evaluationId: string): Promise<Note[]> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'ENSEIGNANT');
  const evaluation = await getEvaluation(evaluationId);
  await verifierPerimetreEnseignant(
    ctx.role,
    ctx.userId,
    ctx.etablissementId,
    evaluation.classeId,
    evaluation.matiereId,
    evaluation.anneeScolaireId,
  );

  const supabase = createClient();
  const { data, error } = await supabase
    .from('note')
    .select(NOTE_FIELDS)
    .eq('evaluationId', evaluationId);
  if (error) throw error;
  return (data ?? []) as unknown as Note[];
}

/**
 * Saisit (upsert) la note d'un élève pour une évaluation. Autorisé seulement
 * si la note n'existe pas encore ou est en statut BROUILLON — une fois
 * SOUMISE, il faut passer par demanderModification.
 */
export async function saisirNote(
  evaluationId: string,
  eleveId: string,
  valeur: number,
  observation?: string,
): Promise<Note> {
  const ctx = await requireRole('ENSEIGNANT');
  const evaluation = await getEvaluation(evaluationId);
  await verifierPerimetreEnseignant(
    ctx.role,
    ctx.userId,
    ctx.etablissementId,
    evaluation.classeId,
    evaluation.matiereId,
    evaluation.anneeScolaireId,
  );

  if (valeur < 0 || valeur > 20) {
    throw new Error('La note doit être comprise entre 0 et 20.');
  }

  const supabase = createClient();
  const { data: existing, error: existingError } = await supabase
    .from('note')
    .select(NOTE_FIELDS)
    .eq('evaluationId', evaluationId)
    .eq('eleveId', eleveId)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing && existing.statut !== 'BROUILLON') {
    throw new Error(
      'Cette note a déjà été soumise : utilisez la demande de modification pour la changer.',
    );
  }

  const { data, error } = await supabase
    .from('note')
    .upsert(
      {
        evaluationId,
        eleveId,
        valeur,
        observation: observation ?? null,
        statut: 'BROUILLON',
      },
      { onConflict: 'evaluationId,eleveId' },
    )
    .select(NOTE_FIELDS)
    .single();
  if (error) throw error;

  await auditLog({
    action: 'SAISIR_NOTE',
    module: 'academique',
    objetType: 'Note',
    objetId: data.id,
    nouvelleValeur: { valeur, observation },
  });

  return data as unknown as Note;
}

/**
 * Bascule en masse toutes les notes BROUILLON d'une évaluation vers SOUMISE
 * via la RPC transactionnelle fn_soumettre_notes (voir migration 0006).
 */
export async function soumettreNotes(evaluationId: string): Promise<number> {
  const ctx = await requireRole('ENSEIGNANT', 'DIRECTEUR', 'SECRETAIRE');
  const evaluation = await getEvaluation(evaluationId);
  await verifierPerimetreEnseignant(
    ctx.role,
    ctx.userId,
    ctx.etablissementId,
    evaluation.classeId,
    evaluation.matiereId,
    evaluation.anneeScolaireId,
  );

  const supabase = createClient();
  const { data, error } = await supabase.rpc('fn_soumettre_notes', {
    p_evaluation_id: evaluationId,
  });
  if (error) throw error;

  await auditLog({
    action: 'SOUMETTRE_NOTES',
    module: 'academique',
    objetType: 'Evaluation',
    objetId: evaluationId,
    nouvelleValeur: { nombreNotes: data },
  });

  return data as number;
}

/**
 * Demande de modification sur une note déjà SOUMISE. Stocke la valeur
 * proposée sans toucher `valeur` (l'original reste la valeur affichée tant
 * que non approuvé). Statut → EN_ATTENTE.
 */
export async function demanderModification(
  noteId: string,
  nouvelleValeur: number,
  observation?: string,
): Promise<Note> {
  const ctx = await requireRole('ENSEIGNANT', 'DIRECTEUR', 'SECRETAIRE');
  if (nouvelleValeur < 0 || nouvelleValeur > 20) {
    throw new Error('La note doit être comprise entre 0 et 20.');
  }

  const supabase = createClient();
  const { data: existing, error: existingError } = await supabase
    .from('note')
    .select(NOTE_FIELDS)
    .eq('id', noteId)
    .single();
  if (existingError) throw existingError;

  if (existing.statut !== 'SOUMISE') {
    throw new Error('Seule une note SOUMISE peut faire l\'objet d\'une demande de modification.');
  }

  const { data, error } = await supabase
    .from('note')
    .update({
      statut: 'EN_ATTENTE',
      valeurProposee: nouvelleValeur,
      demandePar: ctx.userId,
      observation: observation ?? existing.observation,
    })
    .eq('id', noteId)
    .select(NOTE_FIELDS)
    .single();
  if (error) throw error;

  await auditLog({
    action: 'DEMANDER_MODIFICATION_NOTE',
    module: 'academique',
    objetType: 'Note',
    objetId: noteId,
    ancienneValeur: { valeur: existing.valeur },
    nouvelleValeur: { valeurProposee: nouvelleValeur },
  });

  return data as unknown as Note;
}

async function verifierPin(pin: string): Promise<void> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE');
  const supabase = createClient();
  const { data, error } = await supabase
    .from('utilisateur')
    .select('"pinApprobationHash"')
    .eq('id', ctx.userId)
    .single();
  if (error) throw error;
  if (!data.pinApprobationHash) {
    throw new Error('Aucun PIN d\'approbation configuré pour votre compte.');
  }
  const valid = await verifyPin(pin, data.pinApprobationHash as string);
  if (!valid) {
    throw new Error('PIN invalide.');
  }
}

/** Approuve une demande de modification : applique valeurProposee → valeur, statut → VALIDE. */
export async function approuverModification(noteId: string, pin: string): Promise<Note> {
  await verifierPin(pin);

  const supabase = createClient();
  const { data: existing, error: existingError } = await supabase
    .from('note')
    .select(NOTE_FIELDS)
    .eq('id', noteId)
    .single();
  if (existingError) throw existingError;

  if (existing.statut !== 'EN_ATTENTE') {
    throw new Error('Seule une note EN_ATTENTE peut être approuvée.');
  }

  const { data, error } = await supabase
    .from('note')
    .update({
      valeur: existing.valeurProposee,
      valeurProposee: null,
      statut: 'VALIDE',
    })
    .eq('id', noteId)
    .select(NOTE_FIELDS)
    .single();
  if (error) throw error;

  await auditLog({
    action: 'APPROUVER_MODIFICATION_NOTE',
    module: 'academique',
    objetType: 'Note',
    objetId: noteId,
    ancienneValeur: { valeur: existing.valeur },
    nouvelleValeur: { valeur: existing.valeurProposee },
  });

  return data as unknown as Note;
}

/**
 * Rejette une demande de modification : statut → REJETE, `valeur` d'origine
 * conservée (valeurProposee n'est jamais appliquée). Le motif est stocké
 * dans `observation` (pas de colonne dédiée : cohérent avec le fait qu'une
 * seule demande à la fois est en cours par note, l'historique complet passe
 * par audit_log si besoin de conserver les motifs successifs).
 */
export async function rejeterModification(noteId: string, pin: string, motif: string): Promise<Note> {
  await verifierPin(pin);

  const supabase = createClient();
  const { data: existing, error: existingError } = await supabase
    .from('note')
    .select(NOTE_FIELDS)
    .eq('id', noteId)
    .single();
  if (existingError) throw existingError;

  if (existing.statut !== 'EN_ATTENTE') {
    throw new Error('Seule une note EN_ATTENTE peut être rejetée.');
  }

  const { data, error } = await supabase
    .from('note')
    .update({
      statut: 'REJETE',
      valeurProposee: null,
      observation: motif,
    })
    .eq('id', noteId)
    .select(NOTE_FIELDS)
    .single();
  if (error) throw error;

  await auditLog({
    action: 'REJETER_MODIFICATION_NOTE',
    module: 'academique',
    objetType: 'Note',
    objetId: noteId,
    nouvelleValeur: { motif },
  });

  return data as unknown as Note;
}

export interface NoteEnAttente {
  id: string;
  eleveId: string;
  eleveNom: string;
  elevePrenoms: string;
  classeNom: string;
  matiereNom: string;
  evaluationType: 'INTERROGATION' | 'DEVOIR' | 'COMPOSITION';
  periode: Periode;
  numero: number;
  valeur: number | null;
  valeurProposee: number | null;
  observation: string | null;
  demandePar: string | null;
  demandeParNom: string;
}

interface NoteEnAttenteRow {
  id: string;
  eleveId: string;
  valeur: number | null;
  valeurProposee: number | null;
  observation: string | null;
  demandePar: string | null;
  eleve: { nom: string; prenoms: string } | null;
  evaluation: {
    type: 'INTERROGATION' | 'DEVOIR' | 'COMPOSITION';
    periode: Periode;
    numero: number;
    classe: { nom: string; etablissementId: string } | null;
    matiere: { nom: string } | null;
  } | null;
}

/**
 * File d'attente d'approbation: toutes les notes EN_ATTENTE de l'établissement
 * courant, avec le contexte nécessaire à la décision (élève, classe, matière,
 * évaluation, ancienne/nouvelle valeur, demandeur). Réservé Directeur/Secrétaire.
 */
export async function listNotesEnAttente(): Promise<NoteEnAttente[]> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE');
  const supabase = createClient();

  const { data, error } = await supabase
    .from('note')
    .select(
      `id, "eleveId", valeur, "valeurProposee", observation, "demandePar",
       eleve:eleve!inner(nom, prenoms),
       evaluation:evaluation!inner(type, periode, numero,
         classe:classe!inner(nom, "etablissementId"),
         matiere:matiere!inner(nom))`,
    )
    .eq('statut', 'EN_ATTENTE')
    .eq('evaluation.classe.etablissementId', ctx.etablissementId);
  if (error) throw error;

  const rows = (data ?? []) as unknown as NoteEnAttenteRow[];

  const demandeurIds = Array.from(
    new Set(rows.map((r) => r.demandePar).filter((v): v is string => !!v)),
  );
  const demandeurNoms = new Map<string, string>();
  if (demandeurIds.length > 0) {
    const { data: users, error: usersError } = await supabase
      .from('utilisateur')
      .select('id, nom, prenom')
      .in('id', demandeurIds);
    if (usersError) throw usersError;
    for (const u of (users ?? []) as Array<{ id: string; nom: string; prenom: string }>) {
      demandeurNoms.set(u.id, `${u.prenom} ${u.nom}`);
    }
  }

  return rows.map((r) => ({
    id: r.id,
    eleveId: r.eleveId,
    eleveNom: r.eleve?.nom ?? '',
    elevePrenoms: r.eleve?.prenoms ?? '',
    classeNom: r.evaluation?.classe?.nom ?? '',
    matiereNom: r.evaluation?.matiere?.nom ?? '',
    evaluationType: r.evaluation?.type ?? 'DEVOIR',
    periode: r.evaluation?.periode ?? 'TRIMESTRE_1',
    numero: r.evaluation?.numero ?? 1,
    valeur: r.valeur,
    valeurProposee: r.valeurProposee,
    observation: r.observation,
    demandePar: r.demandePar,
    demandeParNom: r.demandePar ? demandeurNoms.get(r.demandePar) ?? 'Inconnu' : 'Inconnu',
  }));
}

export interface MoyenneMatiereEleve {
  matiereId: string;
  matiereNom: string;
  obligatoire: boolean;
  coefficient: number;
  moyenne: number | null;
}

export interface MoyennesEleveResult {
  eleveId: string;
  matieres: MoyenneMatiereEleve[];
  moyenneTrimestrielle: number | null;
  appreciation: string | null;
}

/** Valeur "effective" d'une note pour le calcul: EN_ATTENTE/REJETE gardent `valeur`. */
function valeurEffective(n: { statut: StatutNote; valeur: number | null }): number | null {
  if (n.statut === 'SOUMISE' || n.statut === 'VALIDE' || n.statut === 'EN_ATTENTE' || n.statut === 'REJETE') {
    return n.valeur;
  }
  return null; // BROUILLON: pas encore une note officielle
}

/**
 * Orchestrateur: lit notes + coefficients + programme depuis la DB, délègue
 * tout calcul au moteur pur `calcul-moyennes.ts` (aucune arithmétique ici).
 */
export async function getMoyennesEleve(
  eleveId: string,
  classeId: string,
  periode: Periode,
  anneeScolaireId: string,
): Promise<MoyennesEleveResult> {
  await requireRole('DIRECTEUR', 'SECRETAIRE', 'ENSEIGNANT');
  const supabase = createClient();

  const { data: classe, error: classeError } = await supabase
    .from('classe')
    .select('id, "niveauId", "serieId"')
    .eq('id', classeId)
    .single();
  if (classeError) throw classeError;

  const programme = await listProgramme(classe.niveauId);

  const { data: evaluations, error: evalError } = await supabase
    .from('evaluation')
    .select('id, "matiereId", type, numero')
    .eq('classeId', classeId)
    .eq('periode', periode);
  if (evalError) throw evalError;

  const evaluationIds = (evaluations ?? []).map((e: { id: string }) => e.id);

  const notesByEvaluation = new Map<string, number | null>();
  if (evaluationIds.length > 0) {
    const { data: notes, error: notesError } = await supabase
      .from('note')
      .select('"evaluationId", valeur, statut')
      .eq('eleveId', eleveId)
      .in('evaluationId', evaluationIds);
    if (notesError) throw notesError;
    for (const n of notes ?? []) {
      notesByEvaluation.set(n.evaluationId, valeurEffective(n));
    }
  }

  const matieres: MoyenneMatiereEleve[] = [];
  for (const item of programme) {
    const matiereEvaluations = (evaluations ?? []).filter(
      (e: { matiereId: string }) => e.matiereId === item.matiereId,
    );

    const interros = matiereEvaluations
      .filter((e: { type: string }) => e.type === 'INTERROGATION')
      .map((e: { id: string }) => notesByEvaluation.get(e.id))
      .filter((v: number | null | undefined): v is number => v !== null && v !== undefined);

    const devoirEval = matiereEvaluations.find((e: { type: string }) => e.type === 'DEVOIR');
    const devoir = devoirEval ? notesByEvaluation.get(devoirEval.id) ?? null : null;

    const compositionEval = matiereEvaluations.find((e: { type: string }) => e.type === 'COMPOSITION');
    const composition = compositionEval ? notesByEvaluation.get(compositionEval.id) ?? null : null;

    const moyInterros = moyenneInterros(interros);
    const moyClasse = moyenneClasse(moyInterros, devoir);
    const moyMatiere = moyenneMatiere(moyClasse, composition);

    const coef = await getCoefficient(item.id, anneeScolaireId, classe.serieId ?? null);

    matieres.push({
      matiereId: item.matiereId,
      matiereNom: item.matiere.nom,
      obligatoire: item.obligatoire,
      coefficient: coef?.coefficient ?? 0,
      moyenne: moyMatiere,
    });
  }

  const moyTrim = moyenneTrimestrielle(
    matieres.map((m) => ({ moyenne: m.moyenne, coefficient: m.coefficient, obligatoire: m.obligatoire })),
  );

  return {
    eleveId,
    matieres,
    moyenneTrimestrielle: moyTrim,
    appreciation: moyTrim === null ? null : appreciation(moyTrim),
  };
}

export interface ClassementEntry {
  eleveId: string;
  moyenneTrimestrielle: number | null;
  rang: number | null;
}

/**
 * Moyennes + classement dense de tous les élèves ACTIFS d'une classe.
 *
 * Délègue à `getResultatsClasse()` : l'implémentation précédente appelait
 * `getMoyennesEleve()` en série, une fois par élève, ce qui produisait des
 * centaines d'aller-retours vers la base. Le contrôle de périmètre enseignant
 * est également porté par ce service.
 */
export async function getClassementClasse(
  classeId: string,
  periode: Periode,
  anneeScolaireId: string,
): Promise<ClassementEntry[]> {
  const resultats = await getResultatsClasse(classeId, periode, anneeScolaireId);
  return resultats.eleves.map((e) => ({
    eleveId: e.eleveId,
    moyenneTrimestrielle: e.moyenneTrimestrielle,
    rang: e.rang,
  }));
}

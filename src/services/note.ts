import { createClient } from '@/lib/supabase/server';
import { requireRole } from './authorization';
import { auditLog } from './audit';
import { getEnseignantParUtilisateur } from './enseignant';
import { exigerPin } from './pin';
import { listProgramme } from './programme';
import { listCoefficients } from './coefficient';
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
  motifRejetSoumission: string | null;
  createdAt: string;
  updatedAt: string;
}

const NOTE_FIELDS =
  'id, "evaluationId", "eleveId", valeur, "valeurProposee", observation, "demandePar", statut, "motifRejetSoumission", "createdAt", "updatedAt"';

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

/**
 * Est-ce que l'utilisateur connecté enseigne bien cette matière dans cette
 * classe ? Réponse par l'affectation, jamais par le rôle.
 *
 * Renvoie l'identifiant d'enseignant quand c'est le cas, `null` sinon. Ne lève
 * pas : deux appelants en font deux choses différentes — l'un refuse, l'autre
 * s'en sert pour empêcher quelqu'un de valider ses propres notes.
 */
async function affectationDeLUtilisateur(
  userId: string,
  etablissementId: string,
  classeId: string,
  matiereId: string,
  anneeScolaireId: string,
): Promise<string | null> {
  const enseignant = await getEnseignantParUtilisateur(userId);
  if (!enseignant) return null;

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
  return (count ?? 0) > 0 ? enseignant.id : null;
}

/**
 * Le droit d'écrire une note vient de l'affectation, pas du rôle.
 *
 * C'est déjà la règle de la RLS depuis le 2026-09-11 — `est_affecte(classe,
 * matiere, annee)` — et c'est celle qu'on applique ici. Un Directeur qui
 * enseigne les mathématiques en 6ème A saisit ses notes comme n'importe quel
 * professeur, et reste bloqué partout ailleurs.
 *
 * L'appelant décide qui y est soumis : la lecture et la soumission gardent la
 * portée établissement pour le Directeur et la Secrétaire, qui font tourner le
 * circuit de validation sur toute l'école.
 */
async function exigerAffectation(
  userId: string,
  etablissementId: string,
  classeId: string,
  matiereId: string,
  anneeScolaireId: string,
): Promise<void> {
  const trouvee = await affectationDeLUtilisateur(
    userId,
    etablissementId,
    classeId,
    matiereId,
    anneeScolaireId,
  );
  if (!trouvee) {
    throw new Error("Accès refusé: vous n'êtes pas affecté à cette classe pour cette matière");
  }
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
  await exigerAffectation(userId, etablissementId, classeId, matiereId, anneeScolaireId);
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
  // Le DIRECTEUR est admis depuis le 2026-09-15, et **seulement** par
  // l'affectation. Beaucoup de directeurs d'écoles privées togolaises
  // enseignent une matière ; la règle précédente les obligeait à tenir un
  // second compte, avec un second mot de passe, pour saisir leurs propres
  // notes. La RLS l'autorisait déjà (`note_ecriture` nomme le DIRECTEUR —
  // l'approbation écrit le statut de la note) : seule la garde applicative
  // était fermée.
  //
  // Les deux paires d'yeux sont préservées autrement, et mieux : il ne peut
  // pas valider une soumission d'une matière qu'il enseigne lui-même — voir
  // `validerSoumissionEvaluation`.
  const ctx = await requireRole('ENSEIGNANT', 'DIRECTEUR');
  const evaluation = await getEvaluation(evaluationId);
  if (ctx.role !== 'SUPER_ADMIN') {
    await exigerAffectation(
      ctx.userId,
      ctx.etablissementId,
      evaluation.classeId,
      evaluation.matiereId,
      evaluation.anneeScolaireId,
    );
  }

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
 *
 * SOUMISE ne rend plus la note officielle : elle attend la validation de la
 * Secrétaire (`validerSoumissionEvaluation`/`rejeterSoumissionEvaluation`,
 * migration 0011). Avant ce correctif, une note soumise comptait
 * immédiatement dans les moyennes sans qu'aucune validation n'ait jamais eu
 * lieu — `valeurEffective()` ci-dessous ne compte plus que VALIDE (+
 * EN_ATTENTE/REJETE, qui dérivent d'une note déjà validée).
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

  // Zéro note basculée n'est pas un succès.
  //
  // `fn_soumettre_notes` fait un `update ... where statut = 'BROUILLON'` et
  // rend le nombre de lignes touchées. Aucune ligne, aucune erreur : la
  // fonction rendait `0`, l'action rendait « succès », l'écran fermait sa
  // fenêtre sans un mot, et l'enseignant repartait convaincu d'avoir rendu ses
  // notes. Rien n'arrivait en approbation, et le directeur ne voyait donc rien
  // non plus — les deux symptômes constatés le 2026-09-15 n'en faisaient qu'un.
  //
  // Le défaut de fond a été corrigé côté écran, qui envoie désormais les
  // lignes avant de soumettre. Cette garde-ci est la seconde barrière : la
  // même famille de panne — un `update` qui ne touche rien et qu'on prend pour
  // un succès — a déjà été payée sur la RLS, et elle ne se voit jamais en
  // production tant que personne ne regarde le compte.
  const basculees = (data as number | null) ?? 0;
  if (basculees === 0) {
    throw new Error(
      'Aucune note à soumettre : saisissez au moins une note, ou vérifiez que vos notes ont bien été enregistrées.',
    );
  }

  await auditLog({
    action: 'SOUMETTRE_NOTES',
    module: 'academique',
    objetType: 'Evaluation',
    objetId: evaluationId,
    nouvelleValeur: { nombreNotes: data },
  });

  return data as number;
}

// Le step-up PIN vit dans `pin.ts` : il est partagé par toutes les actions
// sensibles, pas seulement par l'approbation des notes.
//
// **Le DIRECTEUR y est entré le 2026-09-15, et il aurait dû y être avant.**
// La garde ne nommait que la SECRETAIRE, si bien que les quatre décisions
// d'approbation lui étaient réservées — alors que l'écran `/etablissement/
// notes/approbation` est ouvert au Directeur, que la navigation l'y mène et
// que la RLS l'y autorise. Un Directeur voyait donc la file des soumissions et
// recevait « Accès refusé: rôle DIRECTEUR non autorisé » en cliquant
// « Valider ». Dans une école sans secrétariat — le cas courant — plus aucune
// note ne pouvait devenir officielle.
//
// Le trou est ancien : l'élargissement des droits du Directeur du 2026-09-14 a
// ouvert la RLS, la navigation et l'écran sans regarder cette garde-ci, qui
// est déléguée et n'apparaît donc dans l'instantané de la matrice que comme
// `DELEGUEE:verifierPin` — le diff relu ligne à ligne ne montrait rien.
const verifierPin = (pin: string) => exigerPin(pin, 'DIRECTEUR', 'SECRETAIRE');

/**
 * Personne ne valide ses propres notes — tant qu'il y a quelqu'un d'autre.
 *
 * Un Directeur qui enseigne peut désormais saisir ses notes (voir
 * `saisirNote`). Le laisser ensuite les valider lui-même supprimerait la
 * seconde paire d'yeux : il serait à la fois celui qui donne la note et celui
 * qui la rend officielle.
 *
 * **Mais un blocage sec créerait une impasse.** Dans une école d'un seul
 * administrateur — directeur, professeur de mathématiques et secrétariat à lui
 * tout seul, ce qui existe — plus aucune note de sa matière ne pourrait jamais
 * devenir officielle, et rien à l'écran ne dirait comment s'en sortir. Une
 * garde qui enferme est pire que le risque qu'elle couvre.
 *
 * La règle porte donc sur ce qu'elle protège vraiment : deux paires d'yeux
 * sont exigées **quand deux paires d'yeux existent**. Sinon la validation
 * passe, et l'audit garde la trace que le valideur était aussi l'enseignant.
 */
async function verifierSecondRegard(
  ctx: { userId: string; etablissementId: string },
  evaluation: EvaluationRow,
): Promise<{ estSonPropreCours: boolean }> {
  const sienne = await affectationDeLUtilisateur(
    ctx.userId,
    ctx.etablissementId,
    evaluation.classeId,
    evaluation.matiereId,
    evaluation.anneeScolaireId,
  );
  if (!sienne) return { estSonPropreCours: false };

  const supabase = createClient();
  const { count, error } = await supabase
    .from('utilisateur')
    .select('id', { count: 'exact', head: true })
    .eq('etablissementId', ctx.etablissementId)
    .in('role', ['DIRECTEUR', 'SECRETAIRE'])
    .eq('statut', 'ACTIF')
    .neq('id', ctx.userId);
  if (error) throw error;

  if ((count ?? 0) > 0) {
    throw new Error(
      "Vous enseignez cette matière dans cette classe : la validation de vos propres notes revient à quelqu'un d'autre de la direction.",
    );
  }

  return { estSonPropreCours: true };
}

export interface EvaluationSoumise {
  evaluationId: string;
  classeNom: string;
  matiereNom: string;
  evaluationType: 'INTERROGATION' | 'DEVOIR' | 'COMPOSITION';
  periode: Periode;
  numero: number;
  nombreNotes: number;
}

interface NoteSoumiseRow {
  evaluationId: string;
  evaluation: {
    type: 'INTERROGATION' | 'DEVOIR' | 'COMPOSITION';
    periode: Periode;
    numero: number;
    classe: { nom: string; etablissementId: string } | null;
    matiere: { nom: string } | null;
  } | null;
}

/**
 * Évaluations dont des notes SOUMISE attendent une décision (valider →
 * VALIDE ou rejeter → BROUILLON). Réservé à la Secrétaire, même périmètre que
 * `listNotesEnAttente`.
 */
export async function listEvaluationsSoumises(): Promise<EvaluationSoumise[]> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE');
  const supabase = createClient();

  const { data, error } = await supabase
    .from('note')
    .select(
      `"evaluationId",
       evaluation:evaluation!inner(type, periode, numero,
         classe:classe!inner(nom, "etablissementId"),
         matiere:matiere!inner(nom))`,
    )
    .eq('statut', 'SOUMISE')
    .eq('evaluation.classe.etablissementId', ctx.etablissementId);
  if (error) throw error;

  const rows = (data ?? []) as unknown as NoteSoumiseRow[];
  const parEvaluation = new Map<string, EvaluationSoumise>();
  for (const r of rows) {
    const existing = parEvaluation.get(r.evaluationId);
    if (existing) {
      existing.nombreNotes += 1;
      continue;
    }
    parEvaluation.set(r.evaluationId, {
      evaluationId: r.evaluationId,
      classeNom: r.evaluation?.classe?.nom ?? '',
      matiereNom: r.evaluation?.matiere?.nom ?? '',
      evaluationType: r.evaluation?.type ?? 'DEVOIR',
      periode: r.evaluation?.periode ?? 'TRIMESTRE_1',
      numero: r.evaluation?.numero ?? 1,
      nombreNotes: 1,
    });
  }

  return [...parEvaluation.values()];
}

/**
 * Valide en bloc toutes les notes SOUMISE d'une évaluation : elles
 * deviennent VALIDE et comptent désormais dans les moyennes.
 */
export async function validerSoumissionEvaluation(
  evaluationId: string,
  pin: string,
): Promise<number> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE');
  await verifierPin(pin);

  const evaluation = await getEvaluation(evaluationId);
  const { estSonPropreCours } = await verifierSecondRegard(ctx, evaluation);

  const supabase = createClient();
  const { data, error } = await supabase.rpc('fn_valider_soumission', {
    p_evaluation_id: evaluationId,
  });
  if (error) throw new Error(error.message);

  await auditLog({
    action: 'VALIDER_SOUMISSION_NOTES',
    module: 'academique',
    objetType: 'Evaluation',
    objetId: evaluationId,
    // `autoValidation` n'apparaît que dans le cas où il n'y avait personne
    // d'autre pour valider. C'est la contrepartie de ne pas avoir bloqué : la
    // décision reste retrouvable, nominativement, dans le journal d'audit.
    nouvelleValeur: estSonPropreCours
      ? { nombreNotes: data, autoValidation: true }
      : { nombreNotes: data },
  });

  return data as number;
}

/**
 * Rejette en bloc les notes SOUMISE d'une évaluation : retour en BROUILLON
 * chez l'enseignant, avec le motif conservé (`motifRejetSoumission`) jusqu'à
 * la prochaine soumission.
 */
export async function rejeterSoumissionEvaluation(
  evaluationId: string,
  pin: string,
  motif: string,
): Promise<number> {
  await verifierPin(pin);
  const supabase = createClient();

  const { data, error } = await supabase.rpc('fn_rejeter_soumission', {
    p_evaluation_id: evaluationId,
    p_motif: motif,
  });
  if (error) throw new Error(error.message);

  await auditLog({
    action: 'REJETER_SOUMISSION_NOTES',
    module: 'academique',
    objetType: 'Evaluation',
    objetId: evaluationId,
    nouvelleValeur: { motif, nombreNotes: data },
  });

  return data as number;
}

/**
 * Demande de modification sur une note déjà VALIDE. Stocke la valeur
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

  if (existing.statut !== 'VALIDE') {
    throw new Error('Seule une note VALIDE peut faire l\'objet d\'une demande de modification.');
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
 * évaluation, ancienne/nouvelle valeur, demandeur).
 *
 * Réservé à la **Secrétaire** : l'approbation des notes ne relève pas du
 * Directeur (doc 03). L'ouvrir aux deux rôles diluait la responsabilité sans
 * que personne ne traite la file.
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

/**
 * Valeur "effective" d'une note pour le calcul : seule une note VALIDE (ou
 * dérivée d'une VALIDE — EN_ATTENTE/REJETE gardent `valeur`) est officielle.
 * SOUMISE est exclue : elle attend encore la validation de la Secrétaire
 * (`validerSoumissionEvaluation`) et ne doit pas compter avant.
 */
function valeurEffective(n: { statut: StatutNote; valeur: number | null }): number | null {
  if (n.statut === 'VALIDE' || n.statut === 'EN_ATTENTE' || n.statut === 'REJETE') {
    return n.valeur;
  }
  return null; // BROUILLON / SOUMISE: pas encore une note officielle
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

  // Tous les coefficients en une requête plutôt qu'une par matière.
  const coefficients = await listCoefficients(
    programme.map((item: { id: string }) => item.id),
    anneeScolaireId,
    classe.serieId ?? null,
  );

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

    matieres.push({
      matiereId: item.matiereId,
      matiereNom: item.matiere.nom,
      obligatoire: item.obligatoire,
      coefficient: coefficients.get(item.id) ?? 0,
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

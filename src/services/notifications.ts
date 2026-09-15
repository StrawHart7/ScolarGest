import { createClient } from '@/lib/supabase/server';
import { requireRole } from './authorization';
import { getEnseignantParUtilisateur } from './enseignant';
import type { Periode } from './evaluation';

/**
 * Ce qui attend une personne, déduit de l'état de l'école.
 *
 * **Il n'existe pas de table de notifications**, et c'est un choix : une boîte
 * de réception se désynchronise de la réalité dès qu'une décision est prise
 * ailleurs. Même doctrine que `/demarrage` et que les conseils — on compte ce
 * qui est vrai maintenant, on ne stocke pas un état qui va diverger.
 *
 * ## Ce que ce module répare
 *
 * La cloche de l'en-tête ne comptait que pour la SECRÉTAIRE. Un Directeur
 * n'avait donc **jamais** de pastille, alors que la page de notifications lui
 * montrait bien ses soumissions en attente : le signal manquait, pas la
 * donnée. Dans une école sans secrétariat — le cas courant — personne n'était
 * jamais averti qu'une évaluation attendait.
 *
 * Et l'enseignant, lui, n'avait aucune notification du tout : il soumettait
 * ses notes et n'apprenait jamais qu'elles avaient été validées, ni surtout
 * qu'elles avaient été **renvoyées**. Un travail rejeté restait invisible
 * jusqu'à ce qu'il rouvre la page de lui-même.
 */

export type UrgenceNotification = 'info' | 'avertissement';

export interface Notification {
  /** Stable, sert de clé de rendu. */
  cle: string;
  titre: string;
  detail: string;
  href: string;
  icone: 'approbation' | 'abonnement' | 'retour';
  urgence: UrgenceNotification;
}

/**
 * Fenêtre pendant laquelle une validation reste une nouvelle.
 *
 * Elle est **dite dans le texte** (« ces sept derniers jours ») plutôt que
 * laissée implicite : une notification qui parle d'un événement sans dire
 * quand il a eu lieu laisse croire qu'il vient d'arriver, et l'enseignant part
 * chercher ce qui a changé aujourd'hui.
 */
export const JOURS_VALIDATION_RECENTE = 7;

interface LigneNote {
  statut: string;
  updatedAt: string;
  motifRejetSoumission: string | null;
  evaluation: {
    type: string;
    periode: Periode;
    classe: { nom: string } | null;
    matiere: { nom: string } | null;
  } | null;
}

const LIBELLE_TYPE: Record<string, string> = {
  INTERROGATION: 'interrogation',
  DEVOIR: 'devoir',
  COMPOSITION: 'composition',
};

/**
 * Les retours de la direction sur les notes de l'enseignant connecté :
 * ce qui lui a été renvoyé, et ce qui vient d'être validé.
 *
 * **Le rejet est exact et persistant.** Une note rejetée revient en BROUILLON
 * avec son motif (`motifRejetSoumission`), et ce motif est effacé à la
 * soumission suivante : la notification disparaît donc d'elle-même quand
 * l'enseignant a corrigé. Rien à marquer comme lu.
 *
 * **La validation, elle, est bornée dans le temps.** Rien n'horodate la
 * décision autrement que `note.updatedAt`, et une note validée le reste pour
 * toujours : sans fenêtre, l'enseignant traînerait la même annonce jusqu'en
 * juin.
 */
export async function notificationsEnseignant(): Promise<Notification[]> {
  const ctx = await requireRole('ENSEIGNANT', 'DIRECTEUR');
  const soi = await getEnseignantParUtilisateur(ctx.userId);
  if (!soi) return [];

  const supabase = createClient();
  const { data: affectations, error: erreurAffectations } = await supabase
    .from('affectation_enseignant')
    .select('"classeId", "matiereId"')
    .eq('etablissementId', ctx.etablissementId)
    .eq('enseignantId', soi.id);
  if (erreurAffectations) throw erreurAffectations;

  const siennes = (affectations ?? []) as unknown as { classeId: string; matiereId: string }[];
  if (siennes.length === 0) return [];
  const couples = new Set(siennes.map((a) => `${a.classeId}|${a.matiereId}`));
  const classeIds = [...new Set(siennes.map((a) => a.classeId))];

  const depuis = new Date(Date.now() - JOURS_VALIDATION_RECENTE * 24 * 60 * 60 * 1000);

  // `note` ne porte pas d'`etablissementId` : on borne par les classes de
  // l'enseignant, puis on filtre sur ses couples classe × matière — une classe
  // est partagée entre plusieurs professeurs, s'arrêter à la classe lui
  // montrerait les retours destinés à ses collègues.
  const { data, error } = await supabase
    .from('note')
    .select(
      `statut, "updatedAt", "motifRejetSoumission",
       evaluation:evaluation!inner("classeId", "matiereId", type, periode,
         classe:classe!inner(nom), matiere:matiere!inner(nom))`,
    )
    .in('evaluation.classeId', classeIds)
    .gte('updatedAt', depuis.toISOString())
    .limit(1000);
  if (error) throw error;

  const lignes = ((data ?? []) as unknown as (LigneNote & {
    evaluation: (LigneNote['evaluation'] & { classeId: string; matiereId: string }) | null;
  })[]).filter(
    (n) => n.evaluation && couples.has(`${n.evaluation.classeId}|${n.evaluation.matiereId}`),
  );

  const notifications: Notification[] = [];

  const rejetees = lignes.filter((n) => n.statut === 'BROUILLON' && n.motifRejetSoumission);
  if (rejetees.length > 0) {
    const premiere = rejetees[0]!;
    const autres = new Set(
      rejetees.map((n) => `${n.evaluation?.classe?.nom} ${n.evaluation?.matiere?.nom}`),
    ).size;
    notifications.push({
      cle: 'notes-renvoyees',
      titre:
        autres > 1
          ? `${autres} évaluations vous ont été renvoyées`
          : `Vos notes de ${premiere.evaluation?.matiere?.nom} en ${premiere.evaluation?.classe?.nom} vous ont été renvoyées`,
      detail: premiere.motifRejetSoumission
        ? `Motif : ${premiere.motifRejetSoumission}`
        : 'Corrigez-les puis soumettez-les à nouveau.',
      href: '/etablissement/notes/saisie',
      icone: 'retour',
      urgence: 'avertissement',
    });
  }

  const validees = lignes.filter((n) => n.statut === 'VALIDE');
  if (validees.length > 0) {
    const evaluations = new Set(
      validees.map(
        (n) =>
          `${n.evaluation?.classe?.nom}|${n.evaluation?.matiere?.nom}|${n.evaluation?.type}|${n.evaluation?.periode}`,
      ),
    );
    const premiere = validees[0]!;
    notifications.push({
      cle: 'notes-validees',
      titre:
        evaluations.size > 1
          ? `${evaluations.size} de vos évaluations ont été validées`
          : `Votre ${LIBELLE_TYPE[premiere.evaluation?.type ?? ''] ?? 'évaluation'} de ${premiere.evaluation?.matiere?.nom} en ${premiere.evaluation?.classe?.nom} a été validée`,
      detail: `Ces notes comptent désormais dans les moyennes. Validées ces ${JOURS_VALIDATION_RECENTE} derniers jours.`,
      href: '/etablissement/notes/resultats',
      icone: 'approbation',
      urgence: 'info',
    });
  }

  return notifications;
}

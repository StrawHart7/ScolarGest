import { createClient } from '@/lib/supabase/server';
import { requireRole } from './authorization';
import { PERIODES_ORDONNEES } from '@/lib/periodes';
import type { Periode } from './evaluation';

/**
 * « Qui ne m'a pas encore rendu ses notes ? »
 *
 * C'est la question qu'un directeur pose à voix haute trois fois par
 * trimestre, et à laquelle la plateforme ne savait pas répondre : elle
 * montrait ce qui était **arrivé** — les soumissions à valider, les demandes
 * de correction — jamais ce qui **manquait**. Or c'est le manque qui demande
 * un coup de téléphone.
 *
 * ## Ce que la plateforme sait, et ce qu'elle ne sait pas
 *
 * Elle sait qui enseigne quoi (`affectation_enseignant`) et quelles notes sont
 * saisies. Elle ne connaît **pas** le calendrier de l'école : ni la date des
 * compositions, ni la fin du trimestre. Elle ne peut donc pas dire « en
 * retard », et l'écran ne le dit pas. Un constat, à charge pour le directeur
 * de juger si c'est normal à ce stade.
 *
 * ## Trois états, pas deux
 *
 * « Rien » et « commencé mais pas rendu » n'appellent pas le même geste : dans
 * le second cas les notes sont saisies, il ne manque que la soumission, et le
 * directeur n'a pas à réclamer un travail déjà fait. Les confondre ferait
 * passer un enseignant à jour pour un retardataire.
 *
 * ## Pourquoi on ne compte pas les notes
 *
 * Un trimestre d'une école de 300 élèves, c'est environ 9 000 notes. Les
 * ramener pour les grouper dépasserait la limite de 1 000 lignes de PostgREST,
 * qui tronque **sans erreur** : on annoncerait des notes manquantes qui sont
 * là. Même famille que le « zéro crédible » de `bilanCloture` et que l'URL de
 * 52 Ko du tableau de bord.
 *
 * On interroge donc les **évaluations** — quelques centaines par trimestre —
 * en demandant à PostgREST de ne joindre qu'une note par évaluation
 * (`limit(1, { referencedTable: 'note' })`). Et si le plafond était malgré
 * tout atteint, la fonction lève : sous-déclarer ici, c'est inventer des
 * absences et envoyer un directeur reprocher à un enseignant un travail qu'il
 * a rendu.
 */

/** Plafond de sécurité sur le nombre d'évaluations lues pour une période. */
const PLAFOND_EVALUATIONS = 3000;

export type EtatRemise = 'RIEN' | 'COMMENCE' | 'RENDU';

export interface CoursSuivi {
  classeId: string;
  classeNom: string;
  matiereId: string;
  matiereNom: string;
  etat: EtatRemise;
}

export interface EnseignantSuivi {
  enseignantId: string;
  nomComplet: string;
  /** Les cours de cet enseignant qui n'ont pas encore de notes rendues. */
  manques: CoursSuivi[];
  /** Nombre de cours rendus, sur le total qui lui est confié. */
  rendus: number;
  total: number;
}

export interface CollecteNotes {
  periode: Periode;
  /** Nombre de couples classe × matière confiés à un enseignant. */
  coursTotal: number;
  coursRendus: number;
  enseignantsTotal: number;
  enseignantsAJour: number;
  /** Uniquement les enseignants à qui il manque au moins un cours. */
  enAttente: EnseignantSuivi[];
}

interface LigneAffectation {
  enseignantId: string;
  classeId: string;
  matiereId: string;
  enseignant: { nom: string; prenoms: string } | null;
  classe: { nom: string } | null;
  matiere: { nom: string } | null;
}

const cle = (classeId: string, matiereId: string) => `${classeId}|${matiereId}`;

/**
 * Couples classe × matière ayant au moins une note pour cette période.
 *
 * `statuts` restreint aux notes effectivement rendues ; sans lui, un simple
 * brouillon suffit et c'est ce qui distingue « commencé » de « rien ».
 */
async function couplesAvecNotes(
  classeIds: string[],
  anneeScolaireId: string,
  periode: Periode,
  statuts?: string[],
): Promise<Set<string>> {
  const supabase = createClient();

  let requete = supabase
    .from('evaluation')
    .select('"classeId", "matiereId", note:note!inner(id)')
    .eq('anneeScolaireId', anneeScolaireId)
    .eq('periode', periode)
    .in('classeId', classeIds)
    .limit(1, { referencedTable: 'note' })
    .limit(PLAFOND_EVALUATIONS);

  if (statuts) requete = requete.in('note.statut', statuts);

  const { data, error } = await requete;
  if (error) throw error;

  const lignes = (data ?? []) as unknown as { classeId: string; matiereId: string }[];
  if (lignes.length >= PLAFOND_EVALUATIONS) {
    // Voir l'en-tête : une lecture tronquée transformerait des notes rendues
    // en absences, et l'écran enverrait réclamer un travail déjà fait.
    throw new Error(
      `Trop d'évaluations sur cette période (${lignes.length}) pour établir le suivi des notes.`,
    );
  }

  return new Set(lignes.map((l) => cle(l.classeId, l.matiereId)));
}

/**
 * La période sur laquelle l'école travaille : la plus avancée qui porte au
 * moins une évaluation. Trois comptages plutôt qu'une lecture des périodes
 * présentes — un `select('periode')` serait tronqué à 1 000 lignes et
 * désignerait la mauvaise période sans rien signaler.
 */
async function periodeALaUne(classeIds: string[], anneeScolaireId: string): Promise<Periode> {
  const supabase = createClient();

  const comptes = await Promise.all(
    PERIODES_ORDONNEES.map(async (periode) => {
      const { count, error } = await supabase
        .from('evaluation')
        .select('id', { count: 'exact', head: true })
        .eq('anneeScolaireId', anneeScolaireId)
        .eq('periode', periode)
        .in('classeId', classeIds);
      if (error) throw error;
      return { periode, count: count ?? 0 };
    }),
  );

  for (let i = comptes.length - 1; i >= 0; i -= 1) {
    if (comptes[i]!.count > 0) return comptes[i]!.periode;
  }
  return 'TRIMESTRE_1';
}

/**
 * Où en est la remise des notes, pour une période.
 *
 * Ouvert au Directeur et à la Secrétaire — les deux rôles qui font tourner le
 * circuit de validation. Pas au Comptable, pas à l'Enseignant : ce dernier
 * verrait le retard de ses collègues.
 *
 * `periode` omise : la période la plus avancée qui porte des évaluations.
 */
export async function etatCollecteNotes(
  anneeScolaireId: string,
  periode?: Periode,
): Promise<CollecteNotes> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE');
  const supabase = createClient();

  const { data, error } = await supabase
    .from('affectation_enseignant')
    .select(
      '"enseignantId", "classeId", "matiereId", enseignant:enseignant(nom, prenoms), classe:classe(nom), matiere:matiere(nom)',
    )
    .eq('etablissementId', ctx.etablissementId)
    .eq('anneeScolaireId', anneeScolaireId);
  if (error) throw error;

  const affectations = (data ?? []) as unknown as LigneAffectation[];
  if (affectations.length === 0) {
    return {
      periode: periode ?? 'TRIMESTRE_1',
      coursTotal: 0,
      coursRendus: 0,
      enseignantsTotal: 0,
      enseignantsAJour: 0,
      enAttente: [],
    };
  }

  const classeIds = [...new Set(affectations.map((a) => a.classeId))];
  const periodeRetenue = periode ?? (await periodeALaUne(classeIds, anneeScolaireId));

  // Deux lectures : ce qui est rendu, et ce qui existe ne serait-ce qu'en
  // brouillon. La différence des deux, c'est « commencé, pas encore rendu ».
  const [rendus, amorces] = await Promise.all([
    couplesAvecNotes(classeIds, anneeScolaireId, periodeRetenue, [
      'SOUMISE',
      'VALIDE',
      'EN_ATTENTE',
      'REJETE',
    ]),
    couplesAvecNotes(classeIds, anneeScolaireId, periodeRetenue),
  ]);

  const parEnseignant = new Map<string, EnseignantSuivi>();
  let coursRendus = 0;

  for (const a of affectations) {
    const k = cle(a.classeId, a.matiereId);
    const etat: EtatRemise = rendus.has(k) ? 'RENDU' : amorces.has(k) ? 'COMMENCE' : 'RIEN';
    if (etat === 'RENDU') coursRendus += 1;

    let suivi = parEnseignant.get(a.enseignantId);
    if (!suivi) {
      suivi = {
        enseignantId: a.enseignantId,
        nomComplet: `${a.enseignant?.nom ?? ''} ${a.enseignant?.prenoms ?? ''}`.trim(),
        manques: [],
        rendus: 0,
        total: 0,
      };
      parEnseignant.set(a.enseignantId, suivi);
    }

    suivi.total += 1;
    if (etat === 'RENDU') {
      suivi.rendus += 1;
    } else {
      suivi.manques.push({
        classeId: a.classeId,
        classeNom: a.classe?.nom ?? '',
        matiereId: a.matiereId,
        matiereNom: a.matiere?.nom ?? '',
        etat,
      });
    }
  }

  const enseignants = [...parEnseignant.values()];
  const enAttente = enseignants
    .filter((e) => e.manques.length > 0)
    // Le plus en retard d'abord : c'est l'ordre dans lequel on décroche le
    // téléphone. À égalité, l'ordre alphabétique, pour que la liste ne se
    // réordonne pas d'un affichage à l'autre.
    .sort((a, b) => b.manques.length - a.manques.length || a.nomComplet.localeCompare(b.nomComplet));

  for (const e of enAttente) {
    e.manques.sort(
      (x, y) =>
        x.matiereNom.localeCompare(y.matiereNom) || x.classeNom.localeCompare(y.classeNom),
    );
  }

  return {
    periode: periodeRetenue,
    coursTotal: affectations.length,
    coursRendus,
    enseignantsTotal: enseignants.length,
    enseignantsAJour: enseignants.filter((e) => e.manques.length === 0).length,
    enAttente,
  };
}

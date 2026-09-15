import { createClient } from '@/lib/supabase/server';
import { requireRole } from './authorization';
import { auditLog } from './audit';
import { exigerPin } from './pin';
import { NOMBRE_JOURS, NOMBRE_RANGS, type Creneau } from '@/lib/emploi-du-temps';

/**
 * Emploi du temps hebdomadaire d'une classe.
 *
 * La grille n'a pas d'horaires (voir la migration `0018`) : les colonnes sont
 * les jours, les lignes des rangs ordonnés. Un créneau est donc identifié par
 * `(classe, jour, rang)`, et les deux conflits qui comptent — une classe sur
 * deux cours, un enseignant sur deux classes — sont des contraintes d'unicité
 * en base plutôt que des vérifications applicatives.
 *
 * Ces vérifications existent malgré tout ici, mais pour une autre raison : le
 * message. `detecterConflitEnseignant` sert à **prévenir** l'utilisateur avant
 * qu'il n'enregistre (« M. Kossi assure déjà Mathématiques en 3ème A à cette
 * heure »), ce qu'un code d'erreur Postgres `23505` ne dira jamais. La base
 * refuse ; l'écran explique. Les deux sont nécessaires, et l'un ne remplace
 * pas l'autre — deux secrétaires qui enregistrent en même temps passeraient
 * toutes deux la vérification applicative.
 */

export {
  JOURS,
  RANGS,
  NOMBRE_JOURS,
  NOMBRE_RANGS,
  type Creneau,
} from '@/lib/emploi-du-temps';

export interface PlacerCreneauInput {
  classeId: string;
  anneeScolaireId: string;
  jour: number;
  rang: number;
  matiereId: string;
  enseignantId?: string | null;
  salle?: string | null;
}

const CRENEAU_FIELDS =
  'id, "etablissementId", "anneeScolaireId", "classeId", jour, rang, "matiereId", "enseignantId", salle, matiere:matiere(nom, code), enseignant:enseignant(nom, prenoms)';

function validerCase(jour: number, rang: number): void {
  if (!Number.isInteger(jour) || jour < 1 || jour > NOMBRE_JOURS) {
    throw new Error('Jour invalide.');
  }
  if (!Number.isInteger(rang) || rang < 1 || rang > NOMBRE_RANGS) {
    throw new Error('Heure invalide.');
  }
}

/**
 * La grille complète d'une classe.
 *
 * L'ENSEIGNANT y a accès en lecture : il consulte déjà les affectations et les
 * élèves de ses classes, lui refuser l'emploi du temps de la classe où il
 * enseigne n'aurait aucun sens. Le COMPTABLE en revanche n'a rien à y faire.
 */
export async function listCreneauxClasse(
  classeId: string,
  anneeScolaireId: string,
): Promise<Creneau[]> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'ENSEIGNANT');
  const supabase = createClient();
  const { data, error } = await supabase
    .from('emploi_du_temps_creneau')
    .select(CRENEAU_FIELDS)
    .eq('etablissementId', ctx.etablissementId)
    .eq('anneeScolaireId', anneeScolaireId)
    .eq('classeId', classeId)
    .order('jour')
    .order('rang');
  if (error) throw error;
  return (data ?? []) as unknown as Creneau[];
}

export interface ConflitEnseignant {
  classeNom: string;
  matiereNom: string;
}

/**
 * « Cet enseignant est-il déjà pris sur cette case ? »
 *
 * Interrogée par l'écran avant l'enregistrement, pour transformer un refus
 * sec en phrase compréhensible. `creneauIgnoreId` permet de modifier un
 * créneau existant sans qu'il se déclare en conflit avec lui-même.
 */
export async function detecterConflitEnseignant(
  enseignantId: string,
  anneeScolaireId: string,
  jour: number,
  rang: number,
  creneauIgnoreId?: string,
): Promise<ConflitEnseignant | null> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE');
  validerCase(jour, rang);
  const supabase = createClient();
  let query = supabase
    .from('emploi_du_temps_creneau')
    .select('id, classe:classe(nom), matiere:matiere(nom)')
    .eq('etablissementId', ctx.etablissementId)
    .eq('anneeScolaireId', anneeScolaireId)
    .eq('enseignantId', enseignantId)
    .eq('jour', jour)
    .eq('rang', rang);
  if (creneauIgnoreId) query = query.neq('id', creneauIgnoreId);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const ligne = data as unknown as {
    classe: { nom: string } | null;
    matiere: { nom: string } | null;
  };
  return {
    classeNom: ligne.classe?.nom ?? 'une autre classe',
    matiereNom: ligne.matiere?.nom ?? 'un autre cours',
  };
}

/**
 * Pose ou remplace le cours d'une case.
 *
 * Un `upsert` sur `(classeId, anneeScolaireId, jour, rang)` : reposer une
 * matière sur une case occupée la remplace, ce qui est le geste attendu quand
 * on rectifie une grille — et rend l'opération idempotente si le formulaire
 * est renvoyé deux fois.
 *
 * Le PIN est exigé parce que l'emploi du temps engage l'organisation de toute
 * une classe et que la Secrétaire le modifie sans validation hiérarchique.
 */
export async function placerCreneau(input: PlacerCreneauInput, pin: string): Promise<string> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE');
  await exigerPin(pin, 'DIRECTEUR', 'SECRETAIRE');
  validerCase(input.jour, input.rang);
  const supabase = createClient();

  // L'enseignant se déduit de l'affectation depuis le 2026-09-15.
  //
  // Le formulaire ne le demande plus : on sait déjà qui enseigne les
  // mathématiques en 1ère C, c'est écrit dans `affectation_enseignant`, et le
  // redemander à chaque case d'une grille de quarante-huit était une saisie
  // pour rien — au collège et au lycée, un cours n'a qu'un professeur.
  //
  // **Mais la colonne reste remplie**, et c'est le point à ne pas rater : c'est
  // elle qui porte l'index unique partiel de la migration `0018`, le seul
  // garde-fou qui empêche de placer le même professeur dans deux classes au
  // même moment. La cesser de remplir aurait supprimé la détection de conflit
  // **sans le moindre message** — et ça ne se découvre qu'un matin, devant une
  // classe sans professeur.
  const enseignantId =
    input.enseignantId ??
    (await enseignantDeLAffectation(
      ctx.etablissementId,
      input.classeId,
      input.matiereId,
      input.anneeScolaireId,
    ));

  const { data, error } = await supabase
    .from('emploi_du_temps_creneau')
    .upsert(
      {
        etablissementId: ctx.etablissementId,
        anneeScolaireId: input.anneeScolaireId,
        classeId: input.classeId,
        jour: input.jour,
        rang: input.rang,
        matiereId: input.matiereId,
        enseignantId,
        salle: input.salle ?? null,
      },
      { onConflict: 'classeId,anneeScolaireId,jour,rang' },
    )
    .select('id')
    .single();
  if (error) throw error;

  await auditLog({
    action: 'PLACER_CRENEAU_EMPLOI_DU_TEMPS',
    module: 'academique',
    objetType: 'CreneauEmploiDuTemps',
    objetId: (data as { id: string }).id,
    nouvelleValeur: {
      classeId: input.classeId,
      jour: input.jour,
      rang: input.rang,
      matiereId: input.matiereId,
      enseignantId,
      salle: input.salle ?? null,
    },
  });

  return (data as { id: string }).id;
}

/**
 * « Le professeur de cette matière est-il déjà pris sur cette case ? »
 *
 * Remplace l'interrogation par enseignant depuis le 2026-09-15 : le formulaire
 * ne le demande plus, donc l'écran ne le connaît pas. La résolution se fait
 * ici, où les affectations sont lisibles.
 *
 * **Le nom du professeur entre dans la réponse**, et c'est nouveau. Avant,
 * c'est l'utilisateur qui l'avait choisi, il savait de qui on parlait.
 * Maintenant qu'il est déduit, « un enseignant est déjà pris » ne lui dirait
 * rien — il faut nommer qui.
 */
export async function detecterConflitPourMatiere(
  classeId: string,
  matiereId: string,
  anneeScolaireId: string,
  jour: number,
  rang: number,
  creneauIgnoreId?: string,
): Promise<{ classeNom: string; matiereNom: string; enseignantNom: string } | null> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE');

  const enseignantId = await enseignantDeLAffectation(
    ctx.etablissementId,
    classeId,
    matiereId,
    anneeScolaireId,
  );
  // Personne d'affecté : aucun conflit possible, l'index est partiel.
  if (!enseignantId) return null;

  const conflit = await detecterConflitEnseignant(
    enseignantId,
    anneeScolaireId,
    jour,
    rang,
    creneauIgnoreId,
  );
  if (!conflit) return null;

  const supabase = createClient();
  const { data } = await supabase
    .from('enseignant')
    .select('nom, prenoms')
    .eq('id', enseignantId)
    .maybeSingle();
  const ens = data as { nom: string; prenoms: string } | null;

  return {
    ...conflit,
    enseignantNom: ens ? `${ens.nom} ${ens.prenoms}` : 'Le professeur de cette matière',
  };
}

/**
 * Qui enseigne cette matière dans cette classe, d'après les affectations.
 *
 * `null` quand personne n'est affecté : la colonne est nullable et son index
 * unique est **partiel**, donc plusieurs créneaux sans enseignant coexistent
 * sans se déclarer en conflit. C'est voulu — une école peut composer sa grille
 * avant d'avoir réparti ses professeurs.
 *
 * Plusieurs affectations pour le même couple ne devraient pas exister
 * (contrainte d'unicité sur `affectation_enseignant`), mais on prend la
 * première sans se plaindre : refuser de placer un cours parce que la table
 * des affectations est douteuse serait punir l'utilisateur d'un défaut qui
 * n'est pas le sien.
 */
async function enseignantDeLAffectation(
  etablissementId: string,
  classeId: string,
  matiereId: string,
  anneeScolaireId: string,
): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('affectation_enseignant')
    .select('"enseignantId"')
    .eq('etablissementId', etablissementId)
    .eq('classeId', classeId)
    .eq('matiereId', matiereId)
    .eq('anneeScolaireId', anneeScolaireId)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as { enseignantId: string } | null)?.enseignantId ?? null;
}

/**
 * Vide une case.
 *
 * Suppression franche : un créneau n'est ni une note, ni une facture. L'audit
 * conserve ce qui a été retiré, et la valeur retirée est relue avant la
 * suppression pour que la trace soit exploitable.
 */
export async function retirerCreneau(id: string, pin: string): Promise<void> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE');
  await exigerPin(pin, 'DIRECTEUR', 'SECRETAIRE');
  const supabase = createClient();

  const { data: avant, error: erreurLecture } = await supabase
    .from('emploi_du_temps_creneau')
    .select('"classeId", jour, rang, "matiereId", "enseignantId"')
    .eq('id', id)
    .eq('etablissementId', ctx.etablissementId)
    .maybeSingle();
  if (erreurLecture) throw erreurLecture;
  if (!avant) throw new Error('Créneau introuvable.');

  const { error } = await supabase
    .from('emploi_du_temps_creneau')
    .delete()
    .eq('id', id)
    .eq('etablissementId', ctx.etablissementId);
  if (error) throw error;

  await auditLog({
    action: 'RETIRER_CRENEAU_EMPLOI_DU_TEMPS',
    module: 'academique',
    objetType: 'CreneauEmploiDuTemps',
    objetId: id,
    ancienneValeur: avant as Record<string, unknown>,
  });
}

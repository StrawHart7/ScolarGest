import { createClient } from '@/lib/supabase/server';
import { requireRole } from './authorization';
import { auditLog } from './audit';
import { exigerPin } from './pin';

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

/** 1 = lundi … 6 = samedi. Pas de dimanche. */
export const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'] as const;

/**
 * Rangs de la journée. Libellés en toutes lettres, sans heure d'horloge :
 * chaque école place sa journée comme elle l'entend.
 */
export const RANGS = [
  'Première heure',
  'Deuxième heure',
  'Troisième heure',
  'Quatrième heure',
  'Cinquième heure',
  'Sixième heure',
  'Septième heure',
  'Huitième heure',
] as const;

export const NOMBRE_JOURS = JOURS.length;
export const NOMBRE_RANGS = RANGS.length;

export interface Creneau {
  id: string;
  etablissementId: string;
  anneeScolaireId: string;
  classeId: string;
  jour: number;
  rang: number;
  matiereId: string;
  enseignantId: string | null;
  salle: string | null;
  matiere: { nom: string; code: string | null };
  enseignant: { nom: string; prenoms: string } | null;
}

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
        enseignantId: input.enseignantId ?? null,
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
      enseignantId: input.enseignantId ?? null,
      salle: input.salle ?? null,
    },
  });

  return (data as { id: string }).id;
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

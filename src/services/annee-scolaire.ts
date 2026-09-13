import { createClient } from '@/lib/supabase/server';
import { requireRole } from './authorization';
import { exigerPin } from './pin';
import { auditLog } from './audit';

export interface AnneeScolaire {
  id: string;
  etablissementId: string;
  libelle: string;
  dateDebut: string;
  dateFin: string;
  statut: 'PREPARATION' | 'ACTIVE' | 'TERMINEE';
  createdAt: string;
}

export interface CreateAnneeScolaireInput {
  libelle: string;
  dateDebut: string;
  dateFin: string;
}

/**
 * Années scolaires de l'établissement. Ouverte à l'ENSEIGNANT : c'est un
 * catalogue interne sans donnée sensible, et tous ses écrans en dépendent
 * (mes classes, saisie des notes, rapports) — l'en exclure faisait échouer
 * l'espace enseignant en entier.
 */
export async function listAnneesScolaires(): Promise<AnneeScolaire[]> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE', 'ENSEIGNANT');
  const supabase = createClient();
  const { data, error } = await supabase
    .from('annee_scolaire')
    .select('id, "etablissementId", libelle, "dateDebut", "dateFin", statut, "createdAt"')
    .eq('etablissementId', ctx.etablissementId)
    .order('dateDebut', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getAnneeScolaire(id: string): Promise<AnneeScolaire> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE', 'ENSEIGNANT');
  const supabase = createClient();
  const { data, error } = await supabase
    .from('annee_scolaire')
    .select('id, "etablissementId", libelle, "dateDebut", "dateFin", statut, "createdAt"')
    .eq('id', id)
    .eq('etablissementId', ctx.etablissementId)
    .single();
  if (error) throw error;
  return data;
}

export async function createAnneeScolaire(input: CreateAnneeScolaireInput): Promise<AnneeScolaire> {
  const ctx = await requireRole('DIRECTEUR');
  const supabase = createClient();
  const { data, error } = await supabase
    .from('annee_scolaire')
    .insert({
      etablissementId: ctx.etablissementId,
      libelle: input.libelle,
      dateDebut: input.dateDebut,
      dateFin: input.dateFin,
    })
    .select('id, "etablissementId", libelle, "dateDebut", "dateFin", statut, "createdAt"')
    .single();
  if (error) throw error;

  await auditLog({
    action: 'CREATE_ANNEE_SCOLAIRE',
    module: 'structure',
    objetType: 'AnneeScolaire',
    objetId: data.id,
    nouvelleValeur: { libelle: input.libelle },
  });

  return data;
}

/**
 * Active une année scolaire.
 *
 * L'implémentation précédente basculait silencieusement l'année en cours en
 * `TERMINEE` pour libérer l'index unique partiel. Clôturer une année est une
 * décision lourde — elle fige notes, bulletins et facturation — et ne doit pas
 * être un effet de bord d'une activation : l'appel échoue désormais tant que
 * l'année en cours n'a pas été explicitement clôturée.
 */
export async function activerAnneeScolaire(anneeScolaireId: string, pin: string): Promise<void> {
  const ctx = await requireRole('DIRECTEUR');
  await exigerPin(pin, 'DIRECTEUR');
  const supabase = createClient();

  const { data: active, error: activeError } = await supabase
    .from('annee_scolaire')
    .select('id, libelle')
    .eq('etablissementId', ctx.etablissementId)
    .eq('statut', 'ACTIVE')
    .maybeSingle();
  if (activeError) throw activeError;

  if (active && active.id !== anneeScolaireId) {
    throw new Error(
      `L'année ${active.libelle} est encore active. Clôturez-la explicitement avant d'en activer une autre.`,
    );
  }
  if (active && active.id === anneeScolaireId) return;

  const { error: activateError } = await supabase
    .from('annee_scolaire')
    .update({ statut: 'ACTIVE' })
    .eq('id', anneeScolaireId)
    .eq('etablissementId', ctx.etablissementId)
    .eq('statut', 'PREPARATION');
  if (activateError) throw activateError;

  await auditLog({
    action: 'ACTIVER_ANNEE_SCOLAIRE',
    module: 'structure',
    objetType: 'AnneeScolaire',
    objetId: anneeScolaireId,
  });
}

export interface BilanCloture {
  notesEnAttente: number;
  facturesNonSoldees: number;
  resteARecouvrer: number;
}

/**
 * Ce qui reste en suspens sur une année, présenté avant sa clôture.
 *
 * Volontairement informatif et non bloquant : c'est au Directeur de décider
 * s'il clôture avec des impayés (fréquent) ou des notes en attente. Le lui
 * cacher serait pire que le lui laisser trancher.
 *
 * ## Trois défauts corrigés le 2026-09-13, dont deux muets
 *
 * Trouvés dans les journaux de la base, pas dans le code — c'est le genre de
 * défaut qu'aucune relecture n'attrape :
 *
 * - `from('facture')` : **la table s'appelle `facture_eleve`**. PostgREST
 *   répondait 404.
 * - `paiement` filtré sur `etablissementId` : **cette colonne n'existe pas**
 *   sur cette table, pas plus que sur `note` ou `evaluation`. Le piège est
 *   écrit dans `CLAUDE.md` et il a été refait ici. Réponse 400.
 * - le décompte des notes expirait faute d'index — voir la migration
 *   `20260913141655`.
 *
 * **Et aucune des deux premières ne levait**, parce que le code ne récupérait
 * pas `error`. `factures` et `paiements` valaient `null`, donc l'écran
 * annonçait `0 facture non soldée` et `0 F à recouvrer` — à un Directeur sur
 * le point de clôturer une année, geste **irréversible**. Une requête qui
 * échoue doit lever ; un zéro crédible est le pire des retours.
 *
 * Le montant réglé passe par une jointure imbriquée sur `facture_eleve` et non
 * par une liste d'identifiants : cette école a 1 340 évaluations et 286
 * factures, et une liste d'identifiants dans l'URL est une bombe à retardement
 * — c'est exactement ce qui cassait le tableau de bord au même moment.
 */
export async function bilanCloture(anneeScolaireId: string): Promise<BilanCloture> {
  const ctx = await requireRole('DIRECTEUR');
  const supabase = createClient();

  const { count: notesEnAttente, error: erreurNotes } = await supabase
    .from('note')
    .select('id, evaluation:evaluation!inner("anneeScolaireId")', { count: 'exact', head: true })
    .eq('statut', 'EN_ATTENTE')
    .eq('evaluation.anneeScolaireId', anneeScolaireId);
  if (erreurNotes) throw erreurNotes;

  const { data: factures, error: erreurFactures } = await supabase
    .from('facture_eleve')
    .select('id, "montantTotal", statut')
    .eq('etablissementId', ctx.etablissementId)
    .eq('anneeScolaireId', anneeScolaireId)
    .in('statut', ['IMPAYE', 'PARTIEL']);
  if (erreurFactures) throw erreurFactures;

  const { data: paiements, error: erreurPaiements } = await supabase
    .from('paiement')
    .select('montant, "factureId", facture:facture_eleve!inner("anneeScolaireId","etablissementId")')
    .eq('facture.anneeScolaireId', anneeScolaireId)
    .eq('facture.etablissementId', ctx.etablissementId)
    .neq('statut', 'ANNULE');
  if (erreurPaiements) throw erreurPaiements;

  const payeParFacture = new Map<string, number>();
  for (const p of (paiements ?? []) as { montant: number; factureId: string }[]) {
    payeParFacture.set(p.factureId, (payeParFacture.get(p.factureId) ?? 0) + Number(p.montant));
  }
  const resteARecouvrer = ((factures ?? []) as { id: string; montantTotal: number }[]).reduce(
    (somme, f) => somme + Math.max(0, Number(f.montantTotal) - (payeParFacture.get(f.id) ?? 0)),
    0,
  );

  return {
    notesEnAttente: notesEnAttente ?? 0,
    facturesNonSoldees: factures?.length ?? 0,
    resteARecouvrer,
  };
}

/**
 * Clôture explicite d'une année scolaire : ACTIVE → TERMINEE.
 * Irréversible, donc protégée par le PIN du Directeur.
 */
export async function cloturerAnneeScolaire(anneeScolaireId: string, pin: string): Promise<void> {
  const ctx = await requireRole('DIRECTEUR');
  await exigerPin(pin, 'DIRECTEUR');
  const supabase = createClient();

  const { data: annee, error: lectureError } = await supabase
    .from('annee_scolaire')
    .select('id, libelle, statut')
    .eq('id', anneeScolaireId)
    .eq('etablissementId', ctx.etablissementId)
    .single();
  if (lectureError) throw lectureError;
  if (annee.statut !== 'ACTIVE') {
    throw new Error("Seule l'année active peut être clôturée.");
  }

  const bilan = await bilanCloture(anneeScolaireId);

  const { error } = await supabase
    .from('annee_scolaire')
    .update({ statut: 'TERMINEE' })
    .eq('id', anneeScolaireId)
    .eq('etablissementId', ctx.etablissementId)
    .eq('statut', 'ACTIVE');
  if (error) throw error;

  await auditLog({
    action: 'CLOTURER_ANNEE_SCOLAIRE',
    module: 'structure',
    objetType: 'AnneeScolaire',
    objetId: anneeScolaireId,
    // Le bilan est journalisé : on doit pouvoir répondre plus tard à
    // « qu'est-ce qui restait en suspens au moment de la clôture ? ».
    nouvelleValeur: { libelle: annee.libelle, bilan },
  });
}

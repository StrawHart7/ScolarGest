import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from './authorization';
import { auditLog } from './audit';
import {
  creerTransaction,
  declencherPaiementMobile,
  verifierEvenement,
} from '@/lib/fedapay/client';
import { OPERATEURS, type Operateur } from '@/lib/fedapay/operateurs';

/**
 * Paiement en ligne des abonnements (FedaPay, Mobile Money XOF).
 *
 * Deux principes gouvernent tout ce fichier.
 *
 * **1. Le webhook fait foi, pas la redirection de retour.** Une école dont le
 * téléphone s'éteint après avoir confirmé, ou qui ferme son navigateur, doit
 * être activée quand même. La `callback_url` ne sert qu'à afficher un message.
 *
 * **2. Le tenant n'écrit jamais dans `transaction_fedapay`.** La RLS ne lui
 * donne que la lecture (migration `0017`) ; les écritures passent par la clé
 * service-role, depuis un service gardé ou depuis un webhook dont la signature
 * a été vérifiée. Ce que le bénéficiaire d'un paiement peut écrire, il peut le
 * falsifier.
 */

export type Periodicite = 'MOIS' | 'AN';

export interface DemandePaiement {
  periodicite: Periodicite;
  /** `null` pour la page hébergée FedaPay. */
  operateur: Operateur | null;
  /** Requis pour le paiement mobile direct. */
  telephone: string | null;
}

export interface ResultatPaiement {
  transactionId: string;
  /** Renseignée pour le parcours par page hébergée. */
  url: string | null;
  montant: number;
  nombreCycles: number;
}

/**
 * Nombre de cycles facturables : ceux que l'établissement exploite réellement.
 *
 * `cycle_etablissement` modélise déjà cette quantité, et `activerCycle` est
 * gardée par le PIN du Directeur — elle ne peut donc pas être gonflée ou
 * dégonflée d'un clic pour peser sur la facture.
 */
async function compterCyclesFactures(etablissementId: string): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from('cycle_etablissement')
    .select('id', { count: 'exact', head: true })
    .eq('etablissementId', etablissementId)
    .eq('actif', true);
  if (error) throw error;
  // Un établissement qui n'a encore activé aucun cycle paie une unité : il est
  // en pleine configuration, et lui facturer zéro ouvrirait un abonnement
  // gratuit à qui saute l'étape des cycles.
  return Math.max(count ?? 0, 1);
}

/**
 * Prépare un paiement et, en Mobile Money, déclenche l'invite sur le téléphone.
 *
 * Rien n'est débité ici et **aucun abonnement n'est ouvert** : la fonction
 * enregistre une intention. Seul le webhook transforme cette intention en
 * abonnement.
 */
export async function creerIntentionPaiement(
  demande: DemandePaiement,
): Promise<ResultatPaiement> {
  const ctx = await requireRole('DIRECTEUR', 'COMPTABLE');
  if (!ctx.etablissementId) {
    throw new Error('Aucun établissement associé à ce compte.');
  }

  const supabase = createClient();
  const { data: plan, error: erreurPlan } = await supabase
    .from('plan_abonnement')
    .select('id, nom, prix, duree')
    .eq('duree', demande.periodicite)
    .maybeSingle();
  if (erreurPlan) throw erreurPlan;
  if (!plan) throw new Error('Plan tarifaire introuvable.');

  const nombreCycles = await compterCyclesFactures(ctx.etablissementId);
  const montant = Math.round(Number((plan as { prix: number }).prix) * nombreCycles);

  const { data: etab, error: erreurEtab } = await supabase
    .from('etablissement')
    .select('nom')
    .eq('id', ctx.etablissementId)
    .maybeSingle();
  if (erreurEtab) throw erreurEtab;
  const nomEtablissement = (etab as { nom: string } | null)?.nom ?? 'Établissement';

  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const { transaction, creee } = await creerTransaction({
    description: `ScolarGest — ${(plan as { nom: string }).nom}, ${nombreCycles} cycle${nombreCycles > 1 ? 's' : ''} — ${nomEtablissement}`,
    montant,
    callbackUrl: `${base}/abonnement/retour`,
    client: {
      // FedaPay exige un nom et un prénom. L'établissement est le client au
      // sens commercial ; l'email de l'utilisateur sert d'identifiant.
      nom: nomEtablissement.slice(0, 60),
      prenom: ctx.email?.split('@')[0]?.slice(0, 60) || 'Direction',
      email: ctx.email ?? 'contact@scolargest.local',
    },
  });

  // Écriture avec la clé service-role : la RLS interdit au tenant d'écrire
  // dans cette table, précisément pour qu'il ne puisse pas s'inventer un
  // paiement approuvé.
  const admin = createAdminClient();
  const { error: erreurInsert } = await admin.from('transaction_fedapay').insert({
    etablissementId: ctx.etablissementId,
    planId: (plan as { id: string }).id,
    nombreCycles,
    montant,
    fedapayId: creee.id,
    operateur: demande.operateur,
    telephone: demande.telephone,
    urlPaiement: creee.url,
    statut: 'EN_ATTENTE',
  });
  if (erreurInsert) throw erreurInsert;

  await auditLog({
    action: 'CREER_INTENTION_PAIEMENT',
    module: 'saas',
    objetType: 'TransactionFedapay',
    objetId: creee.id,
    nouvelleValeur: { montant, nombreCycles, operateur: demande.operateur },
  });

  if (demande.operateur && demande.telephone && creee.token) {
    const pays = OPERATEURS.find((o) => o.code === demande.operateur)?.pays ?? 'tg';
    await declencherPaiementMobile(
      transaction,
      creee.token,
      demande.operateur,
      demande.telephone,
      pays,
    );
  }

  return { transactionId: creee.id, url: creee.url, montant, nombreCycles };
}

/** Fin de période à partir d'un début et d'une durée de plan. */
function calculerFin(debut: Date, duree: string): Date {
  const fin = new Date(debut);
  if (duree === 'AN') fin.setFullYear(fin.getFullYear() + 1);
  else fin.setMonth(fin.getMonth() + 1);
  return fin;
}

/**
 * Traite un événement FedaPay déjà vérifié.
 *
 * Idempotente, et il le faut : FedaPay rejoue ses livraisons tant qu'il n'a pas
 * reçu d'accusé de réception. Un abonnement prolongé deux fois est un bug qui
 * ne se voit qu'à l'échéance, des mois plus tard.
 *
 * L'idempotence ne repose pas sur un identifiant d'événement mais sur l'état
 * de la transaction : `abonnementId` non nul signifie « déjà honorée ». C'est
 * plus robuste, parce que ça résiste aussi à deux événements distincts portant
 * sur la même transaction.
 */
export async function traiterEvenementFedapay(evenement: {
  name: string;
  entity?: Record<string, unknown>;
}): Promise<{ traite: boolean; raison: string }> {
  const entite = evenement.entity ?? {};
  const fedapayId = entite.id !== undefined && entite.id !== null ? String(entite.id) : null;
  if (!fedapayId) return { traite: false, raison: 'Événement sans identifiant de transaction.' };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('transaction_fedapay')
    .select('id, "etablissementId", "planId", "nombreCycles", montant, statut, "abonnementId"')
    .eq('fedapayId', fedapayId)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    // Transaction inconnue : elle n'a pas été créée par nous. On acquitte
    // quand même, sinon FedaPay rejouerait indéfiniment.
    return { traite: false, raison: 'Transaction inconnue.' };
  }

  const ligne = data as {
    id: string;
    etablissementId: string;
    planId: string;
    nombreCycles: number;
    montant: number;
    statut: string;
    abonnementId: string | null;
  };

  if (evenement.name !== 'transaction.approved') {
    const statut = evenement.name === 'transaction.canceled' ? 'ANNULE' : null;
    if (statut && ligne.statut === 'EN_ATTENTE') {
      await admin.from('transaction_fedapay').update({ statut }).eq('id', ligne.id);
    }
    return { traite: true, raison: `Événement ${evenement.name} enregistré.` };
  }

  if (ligne.abonnementId) {
    return { traite: true, raison: 'Paiement déjà honoré, rejeu ignoré.' };
  }

  const { data: plan, error: erreurPlan } = await admin
    .from('plan_abonnement')
    .select('duree')
    .eq('id', ligne.planId)
    .single();
  if (erreurPlan) throw erreurPlan;

  // La nouvelle période démarre à la fin de la précédente si celle-ci court
  // encore — un renouvellement anticipé ne doit pas faire perdre de jours —
  // sinon aujourd'hui, pour ne pas facturer une période déjà écoulée.
  const { data: courant } = await admin
    .from('abonnement_etablissement')
    .select('"dateFin"')
    .eq('etablissementId', ligne.etablissementId)
    .order('dateFin', { ascending: false })
    .limit(1)
    .maybeSingle();

  const maintenant = new Date();
  const finPrecedente = courant ? new Date((courant as { dateFin: string }).dateFin) : null;
  const debut = finPrecedente && finPrecedente > maintenant ? finPrecedente : maintenant;
  const fin = calculerFin(debut, (plan as { duree: string }).duree);

  const { data: abonnement, error: erreurAbo } = await admin
    .from('abonnement_etablissement')
    .insert({
      etablissementId: ligne.etablissementId,
      planId: ligne.planId,
      dateDebut: debut.toISOString(),
      dateFin: fin.toISOString(),
      statut: 'ACTIF',
      nombreCycles: ligne.nombreCycles,
      montantTotal: ligne.montant,
    })
    .select('id')
    .single();
  if (erreurAbo) throw erreurAbo;

  const abonnementId = (abonnement as { id: string }).id;

  await admin.from('paiement_abonnement').insert({
    abonnementId,
    montant: ligne.montant,
    modePaiement: 'MOBILE_MONEY',
    reference: `FEDAPAY-${fedapayId}`,
  });

  await admin
    .from('transaction_fedapay')
    .update({ statut: 'APPROUVE', abonnementId })
    .eq('id', ligne.id);

  // Journalisation sans contexte de session : l'appelant est FedaPay, pas un
  // utilisateur. `auditLog()` lit le contexte tenant et n'a donc rien à faire
  // ici — on écrit directement, en nommant la source.
  await admin.from('audit_log').insert({
    etablissementId: ligne.etablissementId,
    action: 'PAIEMENT_ABONNEMENT_CONFIRME',
    module: 'saas',
    objetType: 'AbonnementEtablissement',
    objetId: abonnementId,
    nouvelleValeur: {
      source: 'webhook_fedapay',
      fedapayId,
      montant: ligne.montant,
      nombreCycles: ligne.nombreCycles,
    },
  });

  return { traite: true, raison: 'Abonnement ouvert.' };
}

/** Vérifie la signature puis traite. Utilisé par la route de webhook. */
export async function recevoirWebhookFedapay(
  corpsBrut: string,
  signature: string,
): Promise<{ traite: boolean; raison: string }> {
  const evenement = verifierEvenement(corpsBrut, signature);
  return traiterEvenementFedapay(evenement);
}

/** Dernières tentatives de paiement de l'établissement courant. */
export async function listTransactionsFedapay(): Promise<
  { id: string; montant: number; statut: string; createdAt: string; operateur: string | null }[]
> {
  const ctx = await requireRole('DIRECTEUR', 'COMPTABLE');
  const supabase = createClient();
  const { data, error } = await supabase
    .from('transaction_fedapay')
    .select('id, montant, statut, "createdAt", operateur')
    .eq('etablissementId', ctx.etablissementId)
    .order('createdAt', { ascending: false })
    .limit(10);
  if (error) throw error;
  return (data ?? []) as unknown as {
    id: string;
    montant: number;
    statut: string;
    createdAt: string;
    operateur: string | null;
  }[];
}

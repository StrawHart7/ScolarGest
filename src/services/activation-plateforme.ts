import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from './authorization';
import { debutProchainePeriode, finDePeriode } from './abonnement-acces';
import { cyclesFactures } from './paiement-fedapay';
import { nomFormule } from '@/lib/abonnement-formule';

/**
 * Activation d'un abonnement par autorisation de la plateforme, tant que le
 * paiement en ligne n'est pas opérationnel.
 *
 * **Pourquoi ce chemin existe.** Le compte FedaPay n'est pas encore validé :
 * aucun règlement ne peut aboutir. Or les premières écoles doivent pouvoir
 * parcourir le produit de bout en bout, souscription comprise — c'est là que
 * se jouent les questions qu'on veut entendre avant l'ouverture commerciale.
 * L'école suit donc le parcours normal jusqu'au bouton de paiement ; à cet
 * instant, au lieu d'être envoyée vers un prestataire qui refuserait, elle
 * reçoit son abonnement et un message qui dit exactement ce qui s'est passé.
 *
 * **Ce n'est pas une porte dérobée, et trois garde-fous le tiennent :**
 *
 * 1. Le mode est explicite (`PAIEMENT_EN_LIGNE`), pas déduit d'un échec
 *    FedaPay — sinon une panne du prestataire distribuerait des abonnements.
 * 2. `montantTotal` vaut **zéro**, parce que zéro est ce que l'école a payé.
 *    Y inscrire le prix catalogue gonflerait le revenu de la console
 *    plateforme d'argent qui n'existe pas, et cette console sert à décider.
 *    Le montant qui *aurait* été dû est consigné dans le journal d'audit, ce
 *    qui permettra de régulariser sans le reconstituer de mémoire.
 * 3. Aucune ligne de `paiement_abonnement` n'est créée : il n'y a pas eu de
 *    versement, et en inventer un rendrait l'historique de règlements faux.
 *
 * Le jour où FedaPay fonctionne, il suffit de poser `PAIEMENT_EN_LIGNE=ACTIF`
 * pour que le parcours normal reprenne. La console plateforme affiche un
 * avertissement tant que ce n'est pas le cas, pour que ce mode ne s'oublie
 * pas en production.
 */

/** Le paiement en ligne est-il réellement opérationnel ? */
export function paiementEnLigneActif(): boolean {
  return process.env.PAIEMENT_EN_LIGNE === 'ACTIF';
}

export interface ResultatAutorisation {
  finLe: string;
  montantEvite: number;
  nomFormule: string;
  message: string;
}

export async function activerParAutorisationPlateforme(
  periodicite: 'MOIS' | 'AN',
): Promise<ResultatAutorisation> {
  const ctx = await requireRole('DIRECTEUR', 'COMPTABLE');
  if (!ctx.etablissementId) {
    throw new Error('Aucun établissement associé à ce compte.');
  }
  if (paiementEnLigneActif()) {
    // Appelée alors que le paiement fonctionne : c'est un défaut d'aiguillage
    // en amont, pas une situation à rattraper silencieusement.
    throw new Error('Le paiement en ligne est actif : cette activation ne s’applique pas.');
  }

  const supabase = createClient();
  // `public = true` est indispensable depuis la migration `0030` : le plan
  // fondateur porte lui aussi `duree = 'MOIS'`. Sans ce filtre, la periodicite
  // mensuelle ramene **deux** lignes et `maybeSingle()` echoue — pour toutes
  // les ecoles. Meme correction que dans `creerIntentionPaiement`.
  const { data: plan, error: erreurPlan } = await supabase
    .from('plan_abonnement')
    .select('id, prix, duree')
    .eq('duree', periodicite)
    .eq('public', true)
    .maybeSingle();
  if (erreurPlan) throw erreurPlan;
  if (!plan) throw new Error('Plan tarifaire introuvable.');

  const cycles = await cyclesFactures();
  const nombreCycles = Math.max(cycles.length, 1);
  const montantEvite = Math.round(Number((plan as { prix: number }).prix) * nombreCycles);

  // Clé de service : la RLS interdit au tenant d'écrire dans
  // `abonnement_etablissement`, et c'est très bien ainsi — une école ne doit
  // jamais pouvoir s'ouvrir une période. C'est la plateforme qui autorise, le
  // code serveur n'en est que le porte-parole.
  const admin = createAdminClient();

  const [{ data: courant }, { data: etab }] = await Promise.all([
    admin
      .from('abonnement_etablissement')
      .select('"dateFin"')
      .eq('etablissementId', ctx.etablissementId)
      .order('dateFin', { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from('etablissement')
      .select('"essaiFinLe"')
      .eq('id', ctx.etablissementId)
      .maybeSingle(),
  ]);

  const debut = debutProchainePeriode(
    (etab as { essaiFinLe: string | null } | null)?.essaiFinLe ?? null,
    (courant as { dateFin: string } | null)?.dateFin ?? null,
  );
  const fin = finDePeriode(debut, periodicite);

  const { data: abonnement, error } = await admin
    .from('abonnement_etablissement')
    .insert({
      etablissementId: ctx.etablissementId,
      planId: (plan as { id: string }).id,
      dateDebut: debut.toISOString(),
      dateFin: fin.toISOString(),
      statut: 'ACTIF',
      nombreCycles,
      montantTotal: 0,
    })
    .select('id')
    .single();
  if (error) throw error;

  await admin.from('audit_log').insert({
    etablissementId: ctx.etablissementId,
    action: 'ACTIVER_PAR_AUTORISATION_PLATEFORME',
    module: 'saas',
    objetType: 'AbonnementEtablissement',
    objetId: (abonnement as { id: string }).id,
    nouvelleValeur: {
      motif: 'Paiement en ligne indisponible — autorisation de la plateforme.',
      montantEvite,
      nombreCycles,
      periodicite,
      demandePar: ctx.email ?? null,
    },
  });

  const formule = nomFormule(cycles);
  return {
    finLe: fin.toISOString(),
    montantEvite,
    nomFormule: formule,
    message:
      'Le paiement en ligne n’est pas encore ouvert. ScolarGest a autorisé l’activation de votre abonnement sans règlement : votre accès est complet, et nous reviendrons vers vous pour la régularisation.',
  };
}

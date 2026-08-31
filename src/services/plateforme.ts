import { createClient } from '@/lib/supabase/server';
import { requireRole } from './authorization';
import { statutEffectif } from './abonnement-acces';

/**
 * Métriques de la plateforme, pour la console SUPER_ADMIN.
 *
 * `requireRole()` sans argument signifie SUPER_ADMIN seul — c'est bien
 * l'intention ici : ces chiffres agrègent toutes les écoles, aucune d'elles ne
 * doit voir ceux des autres.
 *
 * **Aucune donnée d'élève, de note ou de facture n'est lue.** Le super-admin
 * voit des états d'abonnement, des effectifs et des dates d'activité, jamais le
 * contenu d'un dossier. L'isolation entre écoles est la promesse du produit ;
 * la console de la plateforme ne doit pas être le trou par lequel elle fuit.
 */

export type EtatEcole = 'ESSAI' | 'ACTIF' | 'EXPIRE' | 'SUSPENDU' | 'AUCUN';

export interface EcoleSupervisee {
  id: string;
  nom: string;
  ville: string | null;
  etat: EtatEcole;
  /** Jours restants sur l'essai ou l'abonnement, négatif si dépassé. */
  joursRestants: number | null;
  nombreCycles: number;
  nombreEleves: number;
  montantPeriode: number | null;
  dateFin: string | null;
}

export interface MetriquesPlateforme {
  ecoles: EcoleSupervisee[];
  /** Revenu récurrent ramené au mois, sur les abonnements réellement actifs. */
  revenuMensuel: number;
  /** Encaissements constatés depuis le début du mois courant. */
  encaisseCeMois: number;
  parEtat: Record<EtatEcole, number>;
  /** Écoles dont l'essai ou l'abonnement s'achève dans les 7 jours. */
  echeancesProches: EcoleSupervisee[];
  demandesNouvelles: number;
}

const MS_PAR_JOUR = 24 * 60 * 60 * 1000;

function joursAvant(date: string | null, maintenant: Date): number | null {
  if (!date) return null;
  return Math.ceil((new Date(date).getTime() - maintenant.getTime()) / MS_PAR_JOUR);
}

/**
 * Valeur mensuelle d'un abonnement.
 *
 * Un plan annuel est ramené au douzième. Le montant vient de `montantTotal`,
 * figé à la souscription — jamais du catalogue, dont le prix a pu changer
 * depuis. Recalculer depuis `plan_abonnement` gonflerait ou dégonflerait
 * rétroactivement le revenu constaté.
 */
function valeurMensuelle(montantTotal: number | null, duree: string): number {
  if (montantTotal === null) return 0;
  return duree === 'AN' ? montantTotal / 12 : montantTotal;
}

export async function getMetriquesPlateforme(): Promise<MetriquesPlateforme> {
  await requireRole();
  const supabase = createClient();
  const maintenant = new Date();

  const [
    { data: etablissements, error: erreurEtab },
    { data: abonnements, error: erreurAbo },
    { data: cycles, error: erreurCycles },
    { data: inscriptions, error: erreurInscriptions },
  ] = await Promise.all([
    supabase.from('etablissement').select('id, nom, ville, "essaiFinLe"').order('nom'),
    supabase
      .from('abonnement_etablissement')
      .select('"etablissementId", statut, "dateFin", "montantTotal", "nombreCycles", plan:plan_abonnement(duree)')
      .order('dateFin', { ascending: false }),
    supabase.from('cycle_etablissement').select('"etablissementId"').eq('actif', true),
    // Les effectifs se comptent sur les inscriptions ACTIVE, pas sur la table
    // `eleve` qui accumule les élèves partis.
    supabase.from('inscription').select('"etablissementId"').eq('statut', 'ACTIVE'),
  ]);
  if (erreurEtab) throw erreurEtab;
  if (erreurAbo) throw erreurAbo;
  if (erreurCycles) throw erreurCycles;
  if (erreurInscriptions) throw erreurInscriptions;

  type LigneAbo = {
    etablissementId: string;
    statut: 'ACTIF' | 'EXPIRE' | 'SUSPENDU';
    dateFin: string;
    montantTotal: number | null;
    nombreCycles: number | null;
    plan: { duree: string } | null;
  };

  // Le plus récent par école : la liste est déjà triée par dateFin décroissante,
  // le premier rencontré est donc le courant.
  const aboParEcole = new Map<string, LigneAbo>();
  for (const ligne of (abonnements ?? []) as unknown as LigneAbo[]) {
    if (!aboParEcole.has(ligne.etablissementId)) aboParEcole.set(ligne.etablissementId, ligne);
  }

  const cyclesParEcole = new Map<string, number>();
  for (const c of (cycles ?? []) as { etablissementId: string }[]) {
    cyclesParEcole.set(c.etablissementId, (cyclesParEcole.get(c.etablissementId) ?? 0) + 1);
  }

  const elevesParEcole = new Map<string, number>();
  for (const i of (inscriptions ?? []) as { etablissementId: string }[]) {
    elevesParEcole.set(i.etablissementId, (elevesParEcole.get(i.etablissementId) ?? 0) + 1);
  }

  const parEtat: Record<EtatEcole, number> = {
    ESSAI: 0,
    ACTIF: 0,
    EXPIRE: 0,
    SUSPENDU: 0,
    AUCUN: 0,
  };
  let revenuMensuel = 0;

  const ecoles: EcoleSupervisee[] = ((etablissements ?? []) as {
    id: string;
    nom: string;
    ville: string | null;
    essaiFinLe: string | null;
  }[]).map((e) => {
    const abo = aboParEcole.get(e.id) ?? null;
    const statut = statutEffectif(abo ? { statut: abo.statut, dateFin: abo.dateFin } : null, maintenant);
    const joursEssai = joursAvant(e.essaiFinLe, maintenant);

    // Même ordre que `evaluerAcces` : la suspension prime, puis l'abonnement
    // payé, puis l'essai. Un état de console qui contredirait l'accès réel
    // serait pire qu'une absence d'information.
    let etat: EtatEcole;
    let joursRestants: number | null;
    if (statut === 'SUSPENDU') {
      etat = 'SUSPENDU';
      joursRestants = abo ? joursAvant(abo.dateFin, maintenant) : null;
    } else if (statut === 'ACTIF') {
      etat = 'ACTIF';
      joursRestants = abo ? joursAvant(abo.dateFin, maintenant) : null;
      revenuMensuel += valeurMensuelle(abo?.montantTotal ?? null, abo?.plan?.duree ?? 'MOIS');
    } else if (joursEssai !== null && joursEssai > 0) {
      etat = 'ESSAI';
      joursRestants = joursEssai;
    } else if (statut === 'EXPIRE') {
      etat = 'EXPIRE';
      joursRestants = abo ? joursAvant(abo.dateFin, maintenant) : null;
    } else {
      etat = 'AUCUN';
      joursRestants = null;
    }

    parEtat[etat] += 1;

    return {
      id: e.id,
      nom: e.nom,
      ville: e.ville,
      etat,
      joursRestants,
      nombreCycles: cyclesParEcole.get(e.id) ?? 0,
      nombreEleves: elevesParEcole.get(e.id) ?? 0,
      montantPeriode: abo?.montantTotal ?? null,
      dateFin: abo?.dateFin ?? null,
    };
  });

  const debutDuMois = new Date(maintenant.getFullYear(), maintenant.getMonth(), 1).toISOString();
  const { data: paiements, error: erreurPaiements } = await supabase
    .from('paiement_abonnement')
    .select('montant')
    .gte('date', debutDuMois);
  if (erreurPaiements) throw erreurPaiements;
  const encaisseCeMois = ((paiements ?? []) as { montant: number }[]).reduce(
    (total, p) => total + Number(p.montant),
    0,
  );

  const { count: demandesNouvelles, error: erreurDemandes } = await supabase
    .from('demande_demo')
    .select('id', { count: 'exact', head: true })
    .eq('statut', 'NOUVELLE');
  if (erreurDemandes) throw erreurDemandes;

  // Les écoles à relancer : essai ou abonnement s'achevant sous 7 jours, et
  // celles déjà tombées. Trié par urgence, le plus en retard d'abord.
  const echeancesProches = ecoles
    .filter(
      (e) =>
        (e.etat === 'ESSAI' || e.etat === 'ACTIF') &&
        e.joursRestants !== null &&
        e.joursRestants <= 7,
    )
    .sort((a, b) => (a.joursRestants ?? 0) - (b.joursRestants ?? 0));

  return {
    ecoles,
    revenuMensuel: Math.round(revenuMensuel),
    encaisseCeMois,
    parEtat,
    echeancesProches,
    demandesNouvelles: demandesNouvelles ?? 0,
  };
}

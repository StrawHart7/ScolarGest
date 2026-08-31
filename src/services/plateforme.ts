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

export interface TransactionSupervisee {
  id: string;
  montant: number;
  statut: string;
  operateur: string | null;
  createdAt: string;
  honoree: boolean;
}

export interface FicheEtablissement {
  etat: EtatEcole;
  joursRestants: number | null;
  essaiDebuteLe: string | null;
  essaiFinLe: string | null;
  cycles: string[];
  anneeActive: string | null;
  nombreEleves: number;
  nombreClasses: number;
  nombreEnseignants: number;
  /** Dernière écriture tracée, tous modules confondus. */
  derniereActivite: string | null;
  transactions: TransactionSupervisee[];
}

/**
 * Fiche d'usage d'une école, pour la console plateforme.
 *
 * Répond à la seule question qui compte avant de relancer ou de suspendre :
 * **cette école s'en sert-elle ?** Un abonnement expiré chez une école à 400
 * élèves et un abonnement expiré chez une coquille vide n'appellent pas le
 * même geste commercial.
 *
 * Volontairement agrégée. Aucun nom d'élève, aucune note, aucune facture — la
 * console compte, elle ne consulte pas. L'isolation entre écoles est la
 * promesse du produit, et elle ne doit pas fuir par ici.
 */
export async function getFicheEtablissement(etablissementId: string): Promise<FicheEtablissement> {
  await requireRole();
  const supabase = createClient();
  const maintenant = new Date();

  const { data: etab, error: erreurEtab } = await supabase
    .from('etablissement')
    .select('"essaiDebuteLe", "essaiFinLe"')
    .eq('id', etablissementId)
    .maybeSingle();
  if (erreurEtab) throw erreurEtab;

  const { data: annee } = await supabase
    .from('annee_scolaire')
    .select('id, libelle')
    .eq('etablissementId', etablissementId)
    .eq('statut', 'ACTIVE')
    .maybeSingle();
  const anneeCourante = annee as { id: string; libelle: string } | null;

  const [
    { data: abo },
    { data: cyclesActifs },
    { count: nombreEleves },
    { count: nombreClasses },
    { count: nombreEnseignants },
    { data: audit },
    { data: transactions },
  ] = await Promise.all([
    supabase
      .from('abonnement_etablissement')
      .select('statut, "dateFin"')
      .eq('etablissementId', etablissementId)
      .order('dateFin', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('cycle_etablissement')
      .select('cycle:cycle(nom)')
      .eq('etablissementId', etablissementId)
      .eq('actif', true),
    supabase
      .from('inscription')
      .select('id', { count: 'exact', head: true })
      .eq('etablissementId', etablissementId)
      .eq('statut', 'ACTIVE'),
    anneeCourante
      ? supabase
          .from('classe')
          .select('id', { count: 'exact', head: true })
          .eq('etablissementId', etablissementId)
          .eq('anneeScolaireId', anneeCourante.id)
      : Promise.resolve({ count: 0 }),
    supabase
      .from('enseignant')
      .select('id', { count: 'exact', head: true })
      .eq('etablissementId', etablissementId),
    supabase
      .from('audit_log')
      .select('date')
      .eq('etablissementId', etablissementId)
      .order('date', { ascending: false })
      .limit(1),
    supabase
      .from('transaction_fedapay')
      .select('id, montant, statut, operateur, "createdAt", "abonnementId"')
      .eq('etablissementId', etablissementId)
      .order('createdAt', { ascending: false })
      .limit(10),
  ]);

  const ligneAbo = abo as { statut: 'ACTIF' | 'EXPIRE' | 'SUSPENDU'; dateFin: string } | null;
  const statut = statutEffectif(ligneAbo, maintenant);
  const essaiFinLe = (etab as { essaiFinLe: string | null } | null)?.essaiFinLe ?? null;
  const joursEssai = joursAvant(essaiFinLe, maintenant);

  let etat: EtatEcole;
  let joursRestants: number | null;
  if (statut === 'SUSPENDU') {
    etat = 'SUSPENDU';
    joursRestants = ligneAbo ? joursAvant(ligneAbo.dateFin, maintenant) : null;
  } else if (statut === 'ACTIF') {
    etat = 'ACTIF';
    joursRestants = ligneAbo ? joursAvant(ligneAbo.dateFin, maintenant) : null;
  } else if (joursEssai !== null && joursEssai > 0) {
    etat = 'ESSAI';
    joursRestants = joursEssai;
  } else if (statut === 'EXPIRE') {
    etat = 'EXPIRE';
    joursRestants = ligneAbo ? joursAvant(ligneAbo.dateFin, maintenant) : null;
  } else {
    etat = 'AUCUN';
    joursRestants = null;
  }

  return {
    etat,
    joursRestants,
    essaiDebuteLe: (etab as { essaiDebuteLe: string | null } | null)?.essaiDebuteLe ?? null,
    essaiFinLe,
    cycles: ((cyclesActifs ?? []) as unknown as { cycle: { nom: string } | null }[])
      .map((c) => c.cycle?.nom)
      .filter((n): n is string => Boolean(n)),
    anneeActive: anneeCourante?.libelle ?? null,
    nombreEleves: nombreEleves ?? 0,
    nombreClasses: nombreClasses ?? 0,
    nombreEnseignants: nombreEnseignants ?? 0,
    derniereActivite: ((audit ?? []) as { date: string }[])[0]?.date ?? null,
    transactions: ((transactions ?? []) as {
      id: string;
      montant: number;
      statut: string;
      operateur: string | null;
      createdAt: string;
      abonnementId: string | null;
    }[]).map((t) => ({
      id: t.id,
      montant: Number(t.montant),
      statut: t.statut,
      operateur: t.operateur,
      createdAt: t.createdAt,
      // `abonnementId` non nul est la preuve que le paiement a ouvert une
      // période : c'est plus fiable que le statut, qui pourrait rester en
      // attente si un webhook s'était perdu.
      honoree: t.abonnementId !== null,
    })),
  };
}

export interface EntreeJournal {
  id: string;
  action: string;
  module: string;
  objetType: string;
  objetId: string | null;
  date: string;
  etablissementNom: string | null;
  auteur: string | null;
  ancienneValeur: unknown;
  nouvelleValeur: unknown;
}

export interface FiltresJournal {
  module?: string;
  etablissementId?: string;
  /** Recherche sur le nom de l'action, insensible à la casse. */
  recherche?: string;
  page?: number;
}

export interface PageJournal {
  entrees: EntreeJournal[];
  total: number;
  page: number;
  parPage: number;
  modules: string[];
}

export const TAILLE_PAGE_JOURNAL = 50;

/**
 * Journal d'audit, toutes écoles confondues.
 *
 * `audit_log` est alimenté par chaque écriture sensible depuis la Phase 1, mais
 * n'était lisible que par école, depuis le tableau de bord d'une école. Aucune
 * vue transverse n'existait : impossible de répondre à « qui a annulé ce
 * paiement, et quand », ni de constater qu'une action anormale se répète sur
 * plusieurs tenants.
 *
 * Paginé, et il le faut : ce journal est la table qui grossit le plus vite de
 * toute la base. Tout charger d'un coup marcherait aujourd'hui et deviendrait
 * inutilisable au dixième client.
 *
 * `ancienneValeur` et `nouvelleValeur` sont renvoyées telles quelles. Elles
 * peuvent contenir des données d'école — c'est le prix d'un audit qui sert à
 * quelque chose — mais l'écran ne les déplie qu'à la demande.
 */
export async function listJournalAudit(filtres: FiltresJournal = {}): Promise<PageJournal> {
  await requireRole();
  const supabase = createClient();

  const page = Math.max(1, filtres.page ?? 1);
  const debut = (page - 1) * TAILLE_PAGE_JOURNAL;

  let requete = supabase
    .from('audit_log')
    .select(
      'id, action, module, "objetType", "objetId", date, "ancienneValeur", "nouvelleValeur", etablissement:etablissement(nom), utilisateur:utilisateur(nom, prenom, email)',
      { count: 'exact' },
    )
    .order('date', { ascending: false })
    .range(debut, debut + TAILLE_PAGE_JOURNAL - 1);

  if (filtres.module) requete = requete.eq('module', filtres.module);
  if (filtres.etablissementId) requete = requete.eq('etablissementId', filtres.etablissementId);
  if (filtres.recherche) requete = requete.ilike('action', `%${filtres.recherche}%`);

  const { data, error, count } = await requete;
  if (error) throw error;

  type Ligne = {
    id: string;
    action: string;
    module: string;
    objetType: string;
    objetId: string | null;
    date: string;
    ancienneValeur: unknown;
    nouvelleValeur: unknown;
    etablissement: { nom: string } | null;
    utilisateur: { nom: string; prenom: string; email: string } | null;
  };

  const entrees: EntreeJournal[] = ((data ?? []) as unknown as Ligne[]).map((l) => ({
    id: l.id,
    action: l.action,
    module: l.module,
    objetType: l.objetType,
    objetId: l.objetId,
    date: l.date,
    etablissementNom: l.etablissement?.nom ?? null,
    // Un `userId` nul est normal : une connexion échouée n'a pas d'auteur
    // identifié, et le webhook de paiement n'en a aucun par construction.
    auteur: l.utilisateur
      ? `${l.utilisateur.prenom} ${l.utilisateur.nom}`.trim() || l.utilisateur.email
      : null,
    ancienneValeur: l.ancienneValeur,
    nouvelleValeur: l.nouvelleValeur,
  }));

  // Les modules réellement présents, pour ne proposer que des filtres qui
  // donnent des résultats. Une liste écrite en dur divergerait du code dès
  // qu'un module serait ajouté.
  const { data: tousModules } = await supabase.from('audit_log').select('module').limit(1000);
  const modules = [
    ...new Set(((tousModules ?? []) as { module: string }[]).map((m) => m.module)),
  ].sort();

  return {
    entrees,
    total: count ?? 0,
    page,
    parPage: TAILLE_PAGE_JOURNAL,
    modules,
  };
}

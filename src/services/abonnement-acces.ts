import type { StatutAbonnement } from './abonnement';

/**
 * Effet de l'abonnement — ou de son absence — sur l'accès d'une école.
 *
 * Le principe : ne jamais prendre les données de l'école en otage. Une école
 * qui n'a pas payé perd le droit d'écrire, pas celui de consulter ni
 * d'imprimer les bulletins de ses élèves. C'est aussi ce qui protège le
 * produit commercialement — une école bloquée en pleine session d'examens
 * résilie, une école en lecture seule appelle pour payer.
 *
 * Six niveaux, du plus permissif au plus strict :
 *
 * | Niveau         | Déclencheur                              | Effet                                            |
 * |----------------|------------------------------------------|--------------------------------------------------|
 * | OK             | abonnement actif, > 30 jours restants    | rien                                             |
 * | ESSAI          | pas d'abonnement, essai en cours         | écriture pleine, bandeau de décompte             |
 * | AVERTISSEMENT  | actif, échéance dans 30 jours ou moins   | bandeau, aucun blocage                           |
 * | AVANT_ESSAI    | école neuve, essai pas encore démarré    | configuration seule (voir ci-dessous)            |
 * | LECTURE_SEULE  | EXPIRE, ou essai terminé sans achat      | consultation et documents OK, écritures refusées |
 * | BLOQUE         | établissement suspendu par la plateforme | accès applicatif fermé, page d'information       |
 *
 * `AVANT_ESSAI` existe pour une raison précise. L'essai démarre à la
 * définition du code de confirmation, première étape de `/demarrage` — mais
 * cette étape est une écriture, et une école sans essai ni abonnement se
 * voyait refuser cette écriture par le verrou lui-même. L'essai ne pouvait
 * donc jamais démarrer, et toute école neuve naissait en lecture seule. Le
 * middleware laisse désormais passer les écritures de `/demarrage` tant que
 * l'essai n'a pas démarré ; ce niveau porte le message correspondant, pour ne
 * pas accueillir une école neuve par « contactez ScolarGest ».
 *
 * La suspension est plus stricte que l'expiration parce qu'elle est une
 * décision explicite du SUPER_ADMIN (impayé persistant, litige), pas un
 * simple oubli d'échéance. Depuis la migration `0026` elle porte sur
 * l'établissement et non sur une période : une nouvelle période ne doit pas
 * effacer la sanction.
 *
 * L'essai n'est délibérément pas un abonnement : voir
 * `0015_essai_et_facturation_par_cycle.sql`. Il se lit sur l'établissement, ce
 * qui évite d'inventer un plan à prix nul qui polluerait ensuite l'historique
 * de facturation.
 */
export type NiveauAcces =
  | 'OK'
  | 'ESSAI'
  | 'AVERTISSEMENT'
  | 'AVANT_ESSAI'
  | 'LECTURE_SEULE'
  | 'BLOQUE';

/** Fenêtre d'avertissement avant échéance, en jours. */
export const JOURS_AVERTISSEMENT = 30;

/**
 * Durée de l'essai gratuit, en jours.
 *
 * Miroir de la valeur imposée par `fn_proteger_facturation` (migration
 * `0026`), qui est la seule autorité : la base ne peut pas lire une constante
 * TypeScript. Modifier l'une sans l'autre ferait afficher une échéance
 * différente de celle réellement appliquée.
 */
export const JOURS_ESSAI = 30;

/**
 * Paliers de relance, en jours restants avant l'échéance.
 *
 * L'essai est relancé plus tard et plus serré que l'abonnement : une école en
 * essai n'a encore rien engagé et se décide dans les derniers jours, alors
 * qu'un renouvellement se prépare — un directeur doit pouvoir dégager la somme
 * avant de perdre l'écriture.
 */
export const PALIERS_RELANCE_ESSAI = [7, 3, 1, 0] as const;
export const PALIERS_RELANCE_ABONNEMENT = [15, 7, 1, 0] as const;

export interface AccesAbonnement {
  niveau: NiveauAcces;
  statut: StatutAbonnement | 'AUCUN' | 'ESSAI' | 'AVANT_ESSAI';
  joursRestants: number | null;
  message: string | null;
  /** Motif de suspension, à afficher tel quel. Renseigné au niveau BLOQUE. */
  motifSuspension?: string | null;
}

/**
 * État de facturation d'un établissement : son abonnement le plus récent, la
 * fenêtre d'essai portée par l'établissement lui-même, et une éventuelle
 * suspension.
 *
 * Objet plutôt que paramètres positionnels : la question « cette école
 * peut-elle écrire ? » gagne régulièrement des entrées, et chacune ne doit pas
 * ajouter un argument dont l'ordre se retient mal.
 */
export interface EtatFacturation {
  abonnement: { statut: StatutAbonnement; dateFin: string } | null;
  /** Fin de l'essai gratuit. `null` si l'essai n'a jamais démarré. */
  essaiFinLe?: string | null;
  /** Début de l'essai. Distingue « jamais démarré » de « terminé ». */
  essaiDebuteLe?: string | null;
  /** Suspension plateforme. Le motif est obligatoire en base. */
  suspension?: { le: string; motif: string } | null;
}

const MS_PAR_JOUR = 24 * 60 * 60 * 1000;

/** Jours entiers restants avant l'échéance (négatif si déjà dépassée). */
export function joursAvantEcheance(dateFin: string | Date, maintenant: Date = new Date()): number {
  const fin = typeof dateFin === 'string' ? new Date(dateFin) : dateFin;
  return Math.ceil((fin.getTime() - maintenant.getTime()) / MS_PAR_JOUR);
}

/** Fin d'essai à partir de son démarrage. */
export function finEssai(debut: Date): Date {
  return new Date(debut.getTime() + JOURS_ESSAI * MS_PAR_JOUR);
}

/**
 * Statut réellement applicable, indépendamment de ce qui est stocké : un
 * abonnement ACTIF dont l'échéance est passée est expiré, même si le balayage
 * `fn_expirer_abonnements` n'a pas encore tourné.
 *
 * `SUSPENDU` n'est plus écrit depuis `0026`, mais une ligne d'archive peut
 * encore le porter : elle est traitée comme expirée, jamais comme active. La
 * suspension effective se lit sur l'établissement.
 */
export function statutEffectif(
  abonnement: { statut: StatutAbonnement; dateFin: string } | null,
  maintenant: Date = new Date(),
): StatutAbonnement | 'AUCUN' {
  if (!abonnement) return 'AUCUN';
  if (abonnement.statut === 'SUSPENDU') return 'EXPIRE';
  if (joursAvantEcheance(abonnement.dateFin, maintenant) <= 0) return 'EXPIRE';
  return abonnement.statut;
}

/**
 * Niveau d'accès d'une école à partir de son état de facturation.
 *
 * Ordre d'évaluation, et il compte :
 *   1. La suspension l'emporte toujours — c'est une décision commerciale
 *      explicite, qu'un essai encore ouvert ne doit pas pouvoir contourner.
 *   2. Un abonnement payé et en cours.
 *   3. À défaut, l'essai gratuit s'il court encore.
 *   4. À défaut, l'essai pas encore démarré : école neuve en configuration.
 *   5. Sinon, lecture seule.
 *
 * L'essai passe donc *après* l'abonnement : une école qui paie pendant son
 * essai est traitée comme cliente, pas comme prospect, et le décompte
 * disparaît de son bandeau.
 */
export function evaluerAcces(
  etat: EtatFacturation,
  maintenant: Date = new Date(),
): AccesAbonnement {
  const { abonnement, essaiFinLe = null, essaiDebuteLe = null, suspension = null } = etat;
  const statut = statutEffectif(abonnement, maintenant);
  const joursRestants = abonnement ? joursAvantEcheance(abonnement.dateFin, maintenant) : null;

  if (suspension) {
    return {
      niveau: 'BLOQUE',
      statut,
      joursRestants,
      motifSuspension: suspension.motif,
      message: `L'accès de votre établissement est suspendu. Motif : ${suspension.motif}`,
    };
  }

  if (statut === 'ACTIF') {
    if (joursRestants !== null && joursRestants <= JOURS_AVERTISSEMENT) {
      return {
        niveau: 'AVERTISSEMENT',
        statut,
        joursRestants,
        message: `Votre abonnement expire dans ${joursRestants} jour${joursRestants > 1 ? 's' : ''}. Pensez à le renouveler pour éviter le passage en lecture seule.`,
      };
    }
    return { niveau: 'OK', statut, joursRestants, message: null };
  }

  // Aucun abonnement en cours : l'essai gratuit prend le relais s'il court.
  const joursEssai = essaiFinLe ? joursAvantEcheance(essaiFinLe, maintenant) : null;
  if (joursEssai !== null && joursEssai > 0) {
    return {
      niveau: 'ESSAI',
      statut: 'ESSAI',
      joursRestants: joursEssai,
      message: `Essai gratuit : il vous reste ${joursEssai} jour${joursEssai > 1 ? 's' : ''}. Souscrivez pour conserver l'accès en écriture.`,
    };
  }

  // École neuve : l'essai n'a jamais démarré, la configuration reste ouverte.
  // Le message ne parle ni de paiement ni de blocage — il n'y a rien à
  // régulariser, il y a une configuration à finir.
  // Les deux dates comptent : une fenêtre d'essai connue par sa seule fin — une
  // reprise, un ajustement manuel — est bien un essai, terminé, et non une
  // école neuve. Ne tester que le début ferait rebasculer en configuration une
  // école dont l'essai est échu, donc rouvrirait /demarrage en écriture.
  if (!essaiDebuteLe && !essaiFinLe && statut === 'AUCUN') {
    return {
      niveau: 'AVANT_ESSAI',
      statut: 'AVANT_ESSAI',
      joursRestants: null,
      message: `Terminez la configuration de votre établissement : votre essai gratuit de ${JOURS_ESSAI} jours démarrera dès que vous aurez défini votre code de confirmation.`,
    };
  }

  return {
    niveau: 'LECTURE_SEULE',
    statut,
    joursRestants,
    message:
      joursEssai !== null
        ? "Votre essai gratuit est terminé : l'application est en lecture seule. La consultation et l'impression des documents restent possibles. Souscrivez pour reprendre la saisie."
        : statut === 'AUCUN'
          ? "Aucun abonnement n'est enregistré pour votre établissement : l'application est en lecture seule. Contactez ScolarGest."
          : "Votre abonnement a expiré : l'application est en lecture seule. La consultation et l'impression des documents restent possibles. Souscrivez pour reprendre la saisie.",
  };
}

/**
 * Début de la prochaine période payée.
 *
 * `max(maintenant, fin de l'essai, fin de la période en cours)`. Les trois
 * termes comptent, et chacun corrige une injustice précise :
 *
 * - **la fin de l'essai** : la page de souscription promettait déjà que
 *   souscrire pendant l'essai ne fait pas perdre les jours restants, mais le
 *   webhook ne regardait que l'abonnement. Payer au troisième jour d'essai
 *   coûtait vingt-sept jours ;
 * - **la fin de la période en cours** : un renouvellement anticipé ne doit pas
 *   écraser ce qui a déjà été payé ;
 * - **maintenant** : une période échue ne doit pas être facturée
 *   rétroactivement, sinon l'école paie des jours déjà passés.
 */
export function debutProchainePeriode(
  essaiFinLe: string | null | undefined,
  dateFinCourante: string | null | undefined,
  maintenant: Date = new Date(),
): Date {
  const bornes = [maintenant.getTime()];
  if (essaiFinLe) bornes.push(new Date(essaiFinLe).getTime());
  if (dateFinCourante) bornes.push(new Date(dateFinCourante).getTime());
  return new Date(Math.max(...bornes.filter((t) => Number.isFinite(t))));
}

/**
 * Fin d'une période à partir de son début et de la durée du plan.
 *
 * Le calendrier n'est pas une arithmétique, et `setMonth` seul ne suffit pas :
 * un abonnement mensuel souscrit le **31 janvier** demande un « 31 février »,
 * que JavaScript reporte silencieusement au 3 mars. L'école recevrait un mois
 * gratuit sans que rien ne le signale. Le jour est donc ramené au dernier jour
 * du mois cible, ce qui donne le 28 février attendu.
 *
 * Même raison pour le 29 février d'une année bissextile : l'échéance annuelle
 * tombe au 28 février suivant, et non au 1er mars.
 *
 * Tout est calculé en UTC. Mélanger `getUTCMonth` et `setMonth` ferait dériver
 * l'échéance d'un jour selon le fuseau du serveur — un décalage qui ne se
 * verrait qu'à la limite, donc rarement, donc tard.
 */
export function finDePeriode(debut: Date, duree: 'MOIS' | 'AN'): Date {
  const annee = debut.getUTCFullYear() + (duree === 'AN' ? 1 : 0);
  const mois = debut.getUTCMonth() + (duree === 'MOIS' ? 1 : 0);
  // Jour 0 du mois suivant : le dernier jour du mois visé. `Date.UTC` gère le
  // passage à l'année suivante quand `mois` vaut 12.
  const dernierJourDuMois = new Date(Date.UTC(annee, mois + 1, 0)).getUTCDate();

  const fin = new Date(debut);
  fin.setUTCFullYear(annee, mois, Math.min(debut.getUTCDate(), dernierJourDuMois));
  return fin;
}

/** Une écriture est-elle autorisée à ce niveau d'accès ? */
export function ecritureAutorisee(niveau: NiveauAcces): boolean {
  return niveau === 'OK' || niveau === 'AVERTISSEMENT' || niveau === 'ESSAI';
}

/**
 * Palier de relance à envoyer aujourd'hui, ou `null` s'il n'y en a pas.
 *
 * Le palier retenu est le plus petit encore atteint : à J-6, c'est la relance
 * J-7 qui vaut, pas la J-3 qui n'est pas encore due. Un balayage qui n'aurait
 * pas tourné pendant trois jours rattrape donc la relance manquée plutôt que
 * de la sauter en silence, et l'unicité en base (`idx_relance_unique`) empêche
 * le doublon si elle était déjà partie.
 */
export function palierRelance(
  joursRestants: number,
  paliers: readonly number[],
): number | null {
  const atteints = paliers.filter((p) => joursRestants <= p);
  return atteints.length > 0 ? Math.min(...atteints) : null;
}

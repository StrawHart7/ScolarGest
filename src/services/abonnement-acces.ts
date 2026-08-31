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
 * Cinq niveaux, du plus permissif au plus strict :
 *
 * | Niveau         | Déclencheur                           | Effet                                            |
 * |----------------|---------------------------------------|--------------------------------------------------|
 * | OK             | abonnement actif, > 30 jours restants | rien                                             |
 * | ESSAI          | pas d'abonnement, essai en cours      | écriture pleine, bandeau de décompte             |
 * | AVERTISSEMENT  | actif, échéance dans 30 jours ou moins| bandeau, aucun blocage                           |
 * | LECTURE_SEULE  | EXPIRE, ou essai terminé sans achat   | consultation et documents OK, écritures refusées |
 * | BLOQUE         | SUSPENDU (décision plateforme)        | accès applicatif fermé, page d'information       |
 *
 * La suspension est plus stricte que l'expiration parce qu'elle est une
 * décision explicite du SUPER_ADMIN (impayé persistant, litige), pas un
 * simple oubli d'échéance.
 *
 * L'essai n'est délibérément pas un abonnement : voir
 * `0015_essai_et_facturation_par_cycle.sql`. Il se lit sur l'établissement, ce
 * qui évite d'inventer un plan à prix nul qui polluerait ensuite l'historique
 * de facturation.
 */
export type NiveauAcces = 'OK' | 'ESSAI' | 'AVERTISSEMENT' | 'LECTURE_SEULE' | 'BLOQUE';

/** Fenêtre d'avertissement avant échéance, en jours. */
export const JOURS_AVERTISSEMENT = 30;

/** Durée de l'essai gratuit, en jours. */
export const JOURS_ESSAI = 30;

export interface AccesAbonnement {
  niveau: NiveauAcces;
  statut: StatutAbonnement | 'AUCUN' | 'ESSAI';
  joursRestants: number | null;
  message: string | null;
}

/**
 * État de facturation d'un établissement : son abonnement le plus récent, et
 * la fenêtre d'essai portée par l'établissement lui-même.
 *
 * Objet plutôt que paramètres positionnels : la question « cette école
 * peut-elle écrire ? » gagnera d'autres entrées (période de grâce après un
 * paiement en cours, par exemple), et chacune ne doit pas ajouter un argument
 * dont l'ordre se retient mal.
 */
export interface EtatFacturation {
  abonnement: { statut: StatutAbonnement; dateFin: string } | null;
  /** Fin de l'essai gratuit. `null` si l'essai n'a jamais démarré. */
  essaiFinLe?: string | null;
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
 * `fn_expirer_abonnements` n'a pas encore tourné. La base reste la référence
 * pour SUSPENDU, qui ne se déduit d'aucune date.
 */
export function statutEffectif(
  abonnement: { statut: StatutAbonnement; dateFin: string } | null,
  maintenant: Date = new Date(),
): StatutAbonnement | 'AUCUN' {
  if (!abonnement) return 'AUCUN';
  if (abonnement.statut === 'SUSPENDU') return 'SUSPENDU';
  if (joursAvantEcheance(abonnement.dateFin, maintenant) <= 0) return 'EXPIRE';
  return abonnement.statut;
}

/**
 * Niveau d'accès d'une école à partir de son état de facturation.
 *
 * Ordre d'évaluation, et il compte :
 *   1. SUSPENDU l'emporte toujours — c'est une décision commerciale explicite,
 *      qu'un essai encore ouvert ne doit pas pouvoir contourner.
 *   2. Un abonnement payé et en cours.
 *   3. À défaut, l'essai gratuit s'il court encore.
 *   4. Sinon, lecture seule.
 *
 * L'essai passe donc *après* l'abonnement : une école qui paie pendant son
 * essai est traitée comme cliente, pas comme prospect, et le décompte
 * disparaît de son bandeau.
 */
export function evaluerAcces(
  etat: EtatFacturation,
  maintenant: Date = new Date(),
): AccesAbonnement {
  const { abonnement, essaiFinLe = null } = etat;
  const statut = statutEffectif(abonnement, maintenant);
  const joursRestants = abonnement ? joursAvantEcheance(abonnement.dateFin, maintenant) : null;

  if (statut === 'SUSPENDU') {
    return {
      niveau: 'BLOQUE',
      statut,
      joursRestants,
      message:
        "L'accès de votre établissement est suspendu. Contactez ScolarGest pour rétablir le service.",
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

  return {
    niveau: 'LECTURE_SEULE',
    statut,
    joursRestants,
    message:
      joursEssai !== null
        ? "Votre essai gratuit est terminé : l'application est en lecture seule. La consultation et l'impression des documents restent possibles. Souscrivez pour reprendre la saisie."
        : statut === 'AUCUN'
          ? "Aucun abonnement n'est enregistré pour votre établissement : l'application est en lecture seule. Contactez ScolarGest."
          : "Votre abonnement a expiré : l'application est en lecture seule. La consultation et l'impression des documents restent possibles. Contactez ScolarGest pour le renouveler.",
  };
}

/** Une écriture est-elle autorisée à ce niveau d'accès ? */
export function ecritureAutorisee(niveau: NiveauAcces): boolean {
  return niveau === 'OK' || niveau === 'AVERTISSEMENT' || niveau === 'ESSAI';
}

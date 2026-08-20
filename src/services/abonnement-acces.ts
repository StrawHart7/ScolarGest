import type { StatutAbonnement } from './abonnement';

/**
 * Effet de l'expiration de l'abonnement sur l'accès d'une école — la question
 * laissée ouverte par le doc 08 §22 et Q15 d'`analysis.md`, tranchée ici.
 *
 * Le principe : ne jamais prendre les données de l'école en otage. Une école
 * qui n'a pas payé perd le droit d'écrire, pas celui de consulter ni
 * d'imprimer les bulletins de ses élèves. C'est aussi ce qui protège le
 * produit commercialement — une école bloquée en pleine session d'examens
 * résilie, une école en lecture seule appelle pour payer.
 *
 * Quatre niveaux, du plus permissif au plus strict :
 *
 * | Niveau         | Déclencheur                          | Effet                                   |
 * |----------------|--------------------------------------|-----------------------------------------|
 * | OK             | abonnement actif, > 30 jours restants| rien                                    |
 * | AVERTISSEMENT  | actif, échéance dans 30 jours ou moins| bandeau, aucun blocage                  |
 * | LECTURE_SEULE  | EXPIRE                               | consultation et documents OK, écritures refusées |
 * | BLOQUE         | SUSPENDU (décision plateforme)       | accès applicatif fermé, page d'information |
 *
 * La suspension est plus stricte que l'expiration parce qu'elle est une
 * décision explicite du SUPER_ADMIN (impayé persistant, litige), pas un
 * simple oubli d'échéance.
 */
export type NiveauAcces = 'OK' | 'AVERTISSEMENT' | 'LECTURE_SEULE' | 'BLOQUE';

/** Fenêtre d'avertissement avant échéance, en jours. */
export const JOURS_AVERTISSEMENT = 30;

export interface AccesAbonnement {
  niveau: NiveauAcces;
  statut: StatutAbonnement | 'AUCUN';
  joursRestants: number | null;
  message: string | null;
}

const MS_PAR_JOUR = 24 * 60 * 60 * 1000;

/** Jours entiers restants avant l'échéance (négatif si déjà dépassée). */
export function joursAvantEcheance(dateFin: string | Date, maintenant: Date = new Date()): number {
  const fin = typeof dateFin === 'string' ? new Date(dateFin) : dateFin;
  return Math.ceil((fin.getTime() - maintenant.getTime()) / MS_PAR_JOUR);
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
 * Niveau d'accès d'une école à partir de son abonnement courant.
 * `null` (aucun abonnement enregistré) est traité comme une expiration :
 * l'école a été créée mais son abonnement n'a jamais été saisi, il ne faut ni
 * lui ouvrir l'écriture ni la bloquer brutalement.
 */
export function evaluerAcces(
  abonnement: { statut: StatutAbonnement; dateFin: string } | null,
  maintenant: Date = new Date(),
): AccesAbonnement {
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

  if (statut === 'EXPIRE' || statut === 'AUCUN') {
    return {
      niveau: 'LECTURE_SEULE',
      statut,
      joursRestants,
      message:
        statut === 'AUCUN'
          ? "Aucun abonnement n'est enregistré pour votre établissement : l'application est en lecture seule. Contactez ScolarGest."
          : "Votre abonnement a expiré : l'application est en lecture seule. La consultation et l'impression des documents restent possibles. Contactez ScolarGest pour le renouveler.",
    };
  }

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

/** Une écriture est-elle autorisée à ce niveau d'accès ? */
export function ecritureAutorisee(niveau: NiveauAcces): boolean {
  return niveau === 'OK' || niveau === 'AVERTISSEMENT';
}

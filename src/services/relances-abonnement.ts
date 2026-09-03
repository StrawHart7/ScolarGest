import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { envoyerEmail } from '@/lib/email';
import { urlApplication } from '@/lib/url-app';
import {
  joursAvantEcheance,
  palierRelance,
  statutEffectif,
  PALIERS_RELANCE_ESSAI,
  PALIERS_RELANCE_ABONNEMENT,
} from './abonnement-acces';

/**
 * Balayage quotidien des échéances : constate les expirations et envoie les
 * relances.
 *
 * **Pourquoi un balayage, alors que `statutEffectif` déduit déjà
 * l'expiration.** L'affichage n'a besoin de rien : une échéance dépassée se
 * lit dans la date. Ce qui manquait, c'est le geste sortant. Jusqu'ici une
 * école ne découvrait son passage en lecture seule qu'en se connectant, un
 * matin, sans avertissement — au moment précis où elle avait besoin d'écrire.
 * Aucun mail ne partait, et `expirerAbonnementsEchus` ne tournait qu'à
 * l'ouverture de la console plateforme par le SUPER_ADMIN.
 *
 * **Pas de session.** L'appelant est un planificateur, pas un utilisateur : la
 * clé de service est le seul accès possible, et l'authentification de l'appel
 * se fait par le secret partagé vérifié dans la route.
 *
 * **L'idempotence repose sur l'état, pas sur l'exécution.** La ligne
 * `relance_abonnement` est écrite *avant* l'envoi et l'unicité
 * (établissement, sujet, palier, échéance) fait office de verrou : deux
 * déclenchements le même jour, ou un rejeu, ne produisent pas deux mails.
 * Même raisonnement que `transaction_fedapay.abonnementId` pour le webhook.
 */

export interface BilanRelances {
  expirations: number;
  envoyees: number;
  echecs: number;
  ignorees: number;
  details: string[];
}

type Sujet = 'ESSAI' | 'ABONNEMENT';

interface Destinataire {
  email: string;
  prenom: string;
}

/** Texte de la relance. Le ton se durcit à mesure que l'échéance approche. */
function corpsRelance(
  sujet: Sujet,
  palier: number,
  nomEcole: string,
  echeance: Date,
): { objet: string; texte: string } {
  const dateLisible = echeance.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const lien = `${urlApplication()}/abonnement/souscrire`;

  if (sujet === 'ESSAI') {
    if (palier === 0) {
      return {
        objet: `${nomEcole} — votre essai ScolarGest est terminé`,
        texte: `Votre essai gratuit s'est achevé le ${dateLisible}.

ScolarGest reste ouvert : vous pouvez consulter vos données, imprimer vos bulletins et vos reçus. En revanche, la saisie est suspendue — notes, inscriptions et encaissements ne peuvent plus être enregistrés.

Rien n'est perdu. Tout redevient modifiable dès la souscription : ${lien}`,
      };
    }
    return {
      objet: `${nomEcole} — il vous reste ${palier} jour${palier > 1 ? 's' : ''} d'essai`,
      texte: `Votre essai gratuit de ScolarGest s'achève le ${dateLisible}, dans ${palier} jour${palier > 1 ? 's' : ''}.

Passé cette date, votre espace passe en lecture seule : vos données restent consultables et imprimables, mais la saisie s'arrête — notes, inscriptions, encaissements.

Souscrire prend deux minutes, et les jours d'essai qu'il vous reste ne sont pas perdus : votre période payée démarre à la fin de l'essai.

${lien}`,
    };
  }

  if (palier === 0) {
    return {
      objet: `${nomEcole} — votre abonnement ScolarGest a expiré`,
      texte: `Votre abonnement s'est achevé le ${dateLisible}.

Votre espace est passé en lecture seule. Vos données sont intactes : consultation et impression restent possibles, seule la saisie est suspendue.

Renouveler rétablit l'accès immédiatement : ${lien}`,
    };
  }
  return {
    objet: `${nomEcole} — abonnement à renouveler avant le ${dateLisible}`,
    texte: `Votre abonnement ScolarGest arrive à échéance le ${dateLisible}, dans ${palier} jour${palier > 1 ? 's' : ''}.

Sans renouvellement, votre espace passera en lecture seule : la consultation et l'impression resteront possibles, mais la saisie des notes, des inscriptions et des encaissements sera suspendue.

Renouveler maintenant ne fait perdre aucun jour — la nouvelle période démarre à la fin de l'actuelle.

${lien}`,
  };
}

export async function traiterEcheances(maintenant: Date = new Date()): Promise<BilanRelances> {
  const admin = createAdminClient();
  const bilan: BilanRelances = {
    expirations: 0,
    envoyees: 0,
    echecs: 0,
    ignorees: 0,
    details: [],
  };

  // Constat en base des échéances dépassées. L'affichage ne dépend pas de ce
  // balayage, mais le stocker garde les exports et les rapports cohérents.
  const { data: expirees, error: erreurExpiration } = await admin.rpc('fn_expirer_abonnements');
  if (erreurExpiration) throw new Error(erreurExpiration.message);
  bilan.expirations = (expirees as number) ?? 0;

  const [{ data: etablissements, error: erreurEtab }, { data: abonnements, error: erreurAbo }] =
    await Promise.all([
      admin.from('etablissement').select('id, nom, "essaiFinLe", "suspenduLe"'),
      admin
        .from('abonnement_etablissement')
        .select('"etablissementId", statut, "dateFin"')
        .order('dateFin', { ascending: false }),
    ]);
  if (erreurEtab) throw erreurEtab;
  if (erreurAbo) throw erreurAbo;

  type LigneAbo = { etablissementId: string; statut: 'ACTIF' | 'EXPIRE' | 'SUSPENDU'; dateFin: string };
  const aboParEcole = new Map<string, LigneAbo>();
  for (const ligne of (abonnements ?? []) as LigneAbo[]) {
    if (!aboParEcole.has(ligne.etablissementId)) aboParEcole.set(ligne.etablissementId, ligne);
  }

  // Le Directeur décide, le Comptable paie : les deux sont concernés. La
  // Secrétaire et les Enseignants ne le sont pas — leur envoyer une relance
  // commerciale les mettrait en position de transmettre un message qu'ils ne
  // peuvent pas traiter.
  const { data: utilisateurs, error: erreurUtil } = await admin
    .from('utilisateur')
    .select('"etablissementId", email, prenom, role, statut')
    .in('role', ['DIRECTEUR', 'COMPTABLE'])
    .eq('statut', 'ACTIF');
  if (erreurUtil) throw erreurUtil;

  const contactsParEcole = new Map<string, Destinataire[]>();
  for (const u of (utilisateurs ?? []) as {
    etablissementId: string | null;
    email: string;
    prenom: string;
  }[]) {
    if (!u.etablissementId) continue;
    const liste = contactsParEcole.get(u.etablissementId) ?? [];
    liste.push({ email: u.email, prenom: u.prenom });
    contactsParEcole.set(u.etablissementId, liste);
  }

  for (const ecole of (etablissements ?? []) as {
    id: string;
    nom: string;
    essaiFinLe: string | null;
    suspenduLe: string | null;
  }[]) {
    // Une école suspendue ne reçoit pas de relance commerciale : sa situation
    // relève d'une discussion, pas d'un rappel d'échéance automatique.
    if (ecole.suspenduLe) {
      bilan.ignorees += 1;
      continue;
    }

    const abo = aboParEcole.get(ecole.id) ?? null;
    const statut = statutEffectif(abo, maintenant);

    let sujet: Sujet;
    let echeance: Date;
    let paliers: readonly number[];

    if (statut === 'ACTIF' && abo) {
      sujet = 'ABONNEMENT';
      echeance = new Date(abo.dateFin);
      paliers = PALIERS_RELANCE_ABONNEMENT;
    } else if (ecole.essaiFinLe) {
      // Essai en cours ou tout juste échu. Une école dont l'essai est terminé
      // depuis longtemps a déjà reçu son palier 0 : l'unicité en base empêche
      // de le renvoyer chaque jour.
      sujet = 'ESSAI';
      echeance = new Date(ecole.essaiFinLe);
      paliers = PALIERS_RELANCE_ESSAI;
    } else {
      // Ni abonnement en cours ni essai : école jamais démarrée. Rien à
      // relancer — il n'y a pas d'échéance, donc pas de message honnête à
      // écrire.
      bilan.ignorees += 1;
      continue;
    }

    const jours = joursAvantEcheance(echeance, maintenant);
    const palier = palierRelance(jours, paliers);
    if (palier === null) {
      bilan.ignorees += 1;
      continue;
    }

    const contacts = contactsParEcole.get(ecole.id) ?? [];
    if (contacts.length === 0) {
      bilan.ignorees += 1;
      bilan.details.push(`${ecole.nom} : aucun destinataire actif.`);
      continue;
    }

    // Réservation avant envoi : le conflit d'unicité signifie « déjà traité ».
    const { error: erreurReservation } = await admin.from('relance_abonnement').insert({
      etablissementId: ecole.id,
      sujet,
      palier,
      echeance: echeance.toISOString(),
      destinataires: contacts.map((c) => c.email),
    });
    if (erreurReservation) {
      // 23505 = violation d'unicité : la relance est déjà partie, ce n'est pas
      // une erreur. Toute autre cause en est une et doit remonter.
      if ((erreurReservation as { code?: string }).code === '23505') {
        bilan.ignorees += 1;
        continue;
      }
      throw erreurReservation;
    }

    const { objet, texte } = corpsRelance(sujet, palier, ecole.nom, echeance);
    const resultat = await envoyerEmail({
      destinataires: contacts.map((c) => c.email),
      sujet: objet,
      texte,
    });

    if (resultat.ok) {
      bilan.envoyees += 1;
    } else {
      bilan.echecs += 1;
      bilan.details.push(`${ecole.nom} (${sujet} J-${palier}) : ${resultat.erreur}`);
      // L'échec est consigné sur la ligne réservée plutôt que de la supprimer :
      // effacer la trace ferait réessayer indéfiniment un envoi qui échoue
      // pour une raison durable (adresse invalide, domaine refusé).
      await admin
        .from('relance_abonnement')
        .update({ erreur: resultat.erreur ?? 'Échec inconnu.' })
        .eq('etablissementId', ecole.id)
        .eq('sujet', sujet)
        .eq('palier', palier)
        .eq('echeance', echeance.toISOString());
    }
  }

  return bilan;
}

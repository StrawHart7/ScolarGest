'use server';

import { z } from 'zod';
import { creerIntentionPaiement } from '@/services/paiement-fedapay';
import {
  activerParAutorisationPlateforme,
  paiementEnLigneActif,
} from '@/services/activation-plateforme';
import type { Operateur } from '@/lib/fedapay/operateurs';
import { normaliserNumero, trouverPays } from '@/lib/fedapay/pays';

export interface ResultatSouscription {
  ok: boolean;
  message: string;
  /** Page hébergée FedaPay, pour le parcours de repli. */
  url?: string;
  /**
   * L'abonnement a été ouvert par autorisation de la plateforme, sans
   * règlement, parce que le paiement en ligne n'est pas encore opérationnel.
   * L'écran doit le dire explicitement : une école qui croirait avoir payé
   * s'étonnerait de la facture de régularisation.
   */
  autorisationPlateforme?: boolean;
}

const schema = z.object({
  periodicite: z.enum(['MOIS', 'AN']),
  moyen: z.enum(['MOBILE', 'HEBERGE']),
  operateur: z.string().optional(),
  telephone: z.string().optional(),
  codePays: z.string().optional(),
});

export async function souscrireAction(
  entree: z.input<typeof schema>,
): Promise<ResultatSouscription> {
  const valide = schema.safeParse(entree);
  if (!valide.success) {
    return { ok: false, message: 'Formulaire incomplet.' };
  }
  const { periodicite, moyen, operateur, telephone, codePays } = valide.data;

  // Le paiement en ligne n'est pas encore ouvert (compte FedaPay en cours de
  // validation). Plutôt que d'envoyer l'école vers un prestataire qui
  // refuserait — un échec qu'elle lirait comme un défaut du produit — la
  // plateforme autorise l'activation et le dit. Voir
  // `services/activation-plateforme.ts` pour les garde-fous.
  if (!paiementEnLigneActif()) {
    try {
      const resultat = await activerParAutorisationPlateforme(periodicite);
      return { ok: true, message: resultat.message, autorisationPlateforme: true };
    } catch (e) {
      return {
        ok: false,
        message:
          e instanceof Error ? e.message : "L'activation n'a pas pu être enregistrée.",
      };
    }
  }

  let numero: string | null = null;
  let pays: string | null = null;
  if (moyen === 'MOBILE') {
    if (!operateur) return { ok: false, message: 'Choisissez un opérateur.' };
    if (!codePays || !trouverPays(codePays)) {
      return { ok: false, message: 'Choisissez un pays.' };
    }
    if (!telephone) return { ok: false, message: 'Saisissez votre numéro de téléphone.' };

    // Le pays vient du client : on ne se contente pas de le transmettre, on
    // vérifie qu'il est connu et que le numéro correspond à son plan de
    // numérotation. Un couple pays/numéro incohérent est refusé par FedaPay
    // avec un message que l'école ne pourrait pas interpréter.
    const resultat = normaliserNumero(telephone, codePays);
    if (!resultat.ok || !resultat.numero) {
      return { ok: false, message: resultat.message ?? 'Numéro invalide.' };
    }
    numero = resultat.numero;
    pays = codePays;
  }

  try {
    const resultat = await creerIntentionPaiement({
      periodicite,
      operateur: moyen === 'MOBILE' ? (operateur as Operateur) : null,
      telephone: numero,
      codePays: pays,
    });

    if (moyen === 'MOBILE') {
      return {
        ok: true,
        message:
          'Une demande de confirmation vient d’être envoyée sur votre téléphone. Validez-la pour activer votre abonnement.',
      };
    }

    if (!resultat.url) {
      return {
        ok: false,
        message: 'La page de paiement n’a pas pu être ouverte. Réessayez dans un instant.',
      };
    }
    return { ok: true, message: 'Redirection vers la page de paiement…', url: resultat.url };
  } catch (e) {
    // Les erreurs Supabase ne sont pas des `Error` : ce sont des objets
    // simples, et `e instanceof Error` y est toujours faux. Les erreurs du SDK
    // FedaPay portent quant à elles leur message dans `message`.
    if (e instanceof Error) return { ok: false, message: e.message };
    if (typeof e === 'object' && e !== null) {
      const objet = e as { message?: unknown; details?: unknown; hint?: unknown };
      const parties = [objet.message, objet.details, objet.hint]
        .filter((p): p is string => typeof p === 'string' && p.trim() !== '')
        .join(' — ');
      if (parties) return { ok: false, message: parties };
    }
    return { ok: false, message: 'Le paiement n’a pas pu être initié.' };
  }
}

'use server';

import { z } from 'zod';
import { creerIntentionPaiement } from '@/services/paiement-fedapay';
import type { Operateur } from '@/lib/fedapay/operateurs';

export interface ResultatSouscription {
  ok: boolean;
  message: string;
  /** Page hébergée FedaPay, pour le parcours de repli. */
  url?: string;
}

const schema = z.object({
  periodicite: z.enum(['MOIS', 'AN']),
  moyen: z.enum(['MOBILE', 'HEBERGE']),
  operateur: z.string().optional(),
  telephone: z.string().optional(),
});

/**
 * Numéro togolais : 8 chiffres, éventuellement précédés de l'indicatif 228.
 * FedaPay attend le numéro national seul, sans indicatif ni séparateur.
 */
function normaliserTelephone(brut: string): string | null {
  const chiffres = brut.replace(/\D/g, '');
  const national = chiffres.startsWith('228') ? chiffres.slice(3) : chiffres;
  return national.length === 8 ? national : null;
}

export async function souscrireAction(
  entree: z.input<typeof schema>,
): Promise<ResultatSouscription> {
  const valide = schema.safeParse(entree);
  if (!valide.success) {
    return { ok: false, message: 'Formulaire incomplet.' };
  }
  const { periodicite, moyen, operateur, telephone } = valide.data;

  let numero: string | null = null;
  if (moyen === 'MOBILE') {
    if (!operateur) return { ok: false, message: 'Choisissez un opérateur.' };
    if (!telephone) return { ok: false, message: 'Saisissez votre numéro de téléphone.' };
    numero = normaliserTelephone(telephone);
    if (!numero) {
      return {
        ok: false,
        message: 'Numéro invalide : 8 chiffres attendus, par exemple 90 12 34 56.',
      };
    }
  }

  try {
    const resultat = await creerIntentionPaiement({
      periodicite,
      operateur: moyen === 'MOBILE' ? (operateur as Operateur) : null,
      telephone: numero,
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

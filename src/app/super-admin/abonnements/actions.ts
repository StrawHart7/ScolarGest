'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  createAbonnement,
  validerPaiement,
  suspendreAbonnement,
  reactiverAbonnement,
  renouvelerAbonnement,
} from '@/services/abonnement';

const createSchema = z.object({
  etablissementId: z.string().uuid('Établissement requis'),
  planId: z.string().uuid('Plan requis'),
  dateDebut: z.string().min(1, 'Date de début requise'),
  dateFin: z.string().min(1, 'Date de fin requise'),
});

export async function creerAbonnement(
  _prevState: string | null,
  formData: FormData,
): Promise<string> {
  const parsed = createSchema.safeParse({
    etablissementId: formData.get('etablissementId'),
    planId: formData.get('planId'),
    dateDebut: formData.get('dateDebut'),
    dateFin: formData.get('dateFin'),
  });

  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? 'Formulaire invalide';
  }

  try {
    await createAbonnement(parsed.data);
  } catch (e) {
    return e instanceof Error ? e.message : 'Erreur lors de la création';
  }

  redirect('/super-admin/abonnements');
}

const paiementSchema = z.object({
  abonnementId: z.string().uuid(),
  montant: z.string().min(1, 'Montant requis'),
  modePaiement: z.enum(['ESPECES', 'CHEQUE', 'VIREMENT', 'MOBILE_MONEY', 'AUTRE']),
  reference: z.string().nullable().optional(),
});

export async function enregistrerPaiement(
  _prevState: string | null,
  formData: FormData,
): Promise<string> {
  const parsed = paiementSchema.safeParse({
    abonnementId: formData.get('abonnementId'),
    montant: formData.get('montant'),
    modePaiement: formData.get('modePaiement'),
    reference: formData.get('reference'),
  });

  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? 'Formulaire invalide';
  }

  try {
    await validerPaiement({
      abonnementId: parsed.data.abonnementId,
      montant: Number(parsed.data.montant),
      modePaiement: parsed.data.modePaiement,
      reference: parsed.data.reference || undefined,
    });
  } catch (e) {
    return e instanceof Error ? e.message : "Erreur lors de l'enregistrement";
  }

  redirect('/super-admin/abonnements');
}

export async function suspendre(abonnementId: string): Promise<void> {
  await suspendreAbonnement(abonnementId);
  revalidatePath('/super-admin/abonnements');
}

export async function reactiver(abonnementId: string): Promise<string | null> {
  try {
    await reactiverAbonnement(abonnementId);
  } catch (e) {
    return e instanceof Error ? e.message : 'Erreur lors de la réactivation';
  }
  revalidatePath('/super-admin/abonnements');
  return null;
}

const renouvellementSchema = z.object({
  abonnementId: z.string().uuid('Abonnement requis'),
  planId: z.string().uuid('Plan requis'),
});

/**
 * Ouvre la période suivante. Le nouvel abonnement naît SUSPENDU : il devient
 * ACTIF à la validation du paiement, pas avant.
 */
export async function renouveler(
  _prevState: string | null,
  formData: FormData,
): Promise<string | null> {
  const parsed = renouvellementSchema.safeParse({
    abonnementId: formData.get('abonnementId'),
    planId: formData.get('planId'),
  });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? 'Formulaire invalide';
  }

  try {
    await renouvelerAbonnement(parsed.data.abonnementId, parsed.data.planId);
  } catch (e) {
    return e instanceof Error ? e.message : 'Erreur lors du renouvellement';
  }

  revalidatePath('/super-admin/abonnements');
  return null;
}

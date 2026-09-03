'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  ouvrirPeriode,
  enregistrerReglement,
  suspendreEtablissement,
  leverSuspension,
  prolongerEssai,
} from '@/services/abonnement';

/**
 * Actions de la console plateforme sur les abonnements.
 *
 * Le trio `créer / renouveler / valider le paiement` a disparu au profit d'une
 * seule ouverture de période. Motif : `renouvelerAbonnement` créait la période
 * suivante en `SUSPENDU` en attendant le règlement, or `SUSPENDU` fermait
 * l'accès — préparer l'échéance d'une école parfaitement à jour la mettait
 * dehors. Une ligne d'abonnement n'existe désormais que si elle est acquise.
 */

const ouvertureSchema = z.object({
  etablissementId: z.string().uuid('Établissement requis'),
  planId: z.string().uuid('Plan requis'),
  nombreCycles: z.coerce.number().int().min(1, 'Au moins un cycle'),
  montantTotal: z.coerce.number().min(0, 'Montant invalide'),
  dateDebut: z.string().optional(),
  modePaiement: z
    .enum(['ESPECES', 'CHEQUE', 'VIREMENT', 'MOBILE_MONEY', 'AUTRE'])
    .optional(),
  reference: z.string().nullable().optional(),
  motif: z.string().nullable().optional(),
});

export async function ouvrirPeriodeAction(
  _prevState: string | null,
  formData: FormData,
): Promise<string> {
  const parsed = ouvertureSchema.safeParse({
    etablissementId: formData.get('etablissementId'),
    planId: formData.get('planId'),
    nombreCycles: formData.get('nombreCycles'),
    montantTotal: formData.get('montantTotal'),
    dateDebut: formData.get('dateDebut') || undefined,
    modePaiement: formData.get('modePaiement') || undefined,
    reference: formData.get('reference'),
    motif: formData.get('motif'),
  });

  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? 'Formulaire invalide';
  }

  const { montantTotal, modePaiement } = parsed.data;

  try {
    await ouvrirPeriode({
      etablissementId: parsed.data.etablissementId,
      planId: parsed.data.planId,
      nombreCycles: parsed.data.nombreCycles,
      montantTotal,
      dateDebut: parsed.data.dateDebut,
      // Une période offerte n'a pas de versement à consigner ; en inventer un
      // rendrait l'historique des règlements faux.
      reglement:
        montantTotal > 0 && modePaiement
          ? {
              montant: montantTotal,
              modePaiement,
              reference: parsed.data.reference || undefined,
            }
          : null,
      motif: parsed.data.motif || undefined,
    });
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
    await enregistrerReglement({
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

const suspensionSchema = z.object({
  etablissementId: z.string().uuid('Établissement requis'),
  motif: z
    .string()
    .trim()
    .min(10, 'Indiquez un motif explicite : il sera affiché au Directeur.'),
});

/**
 * Suspend un établissement. Le motif est obligatoire **et affiché à l'école** :
 * un accès coupé sans explication produit un appel au support pour demander
 * pourquoi, là où un motif lisible produit un appel pour le résoudre.
 */
export async function suspendre(
  _prevState: string | null,
  formData: FormData,
): Promise<string | null> {
  const parsed = suspensionSchema.safeParse({
    etablissementId: formData.get('etablissementId'),
    motif: formData.get('motif'),
  });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? 'Formulaire invalide';
  }

  try {
    await suspendreEtablissement(parsed.data.etablissementId, parsed.data.motif);
  } catch (e) {
    return e instanceof Error ? e.message : 'Erreur lors de la suspension';
  }

  revalidatePath('/super-admin/abonnements');
  return null;
}

export async function reactiver(etablissementId: string): Promise<string | null> {
  try {
    await leverSuspension(etablissementId);
  } catch (e) {
    return e instanceof Error ? e.message : 'Erreur lors de la levée de suspension';
  }
  revalidatePath('/super-admin/abonnements');
  return null;
}

const prolongationSchema = z.object({
  etablissementId: z.string().uuid('Établissement requis'),
  jours: z.coerce.number().int().min(1).max(180),
  motif: z.string().trim().min(5, 'Indiquez le motif de la prolongation.'),
});

export async function prolonger(
  _prevState: string | null,
  formData: FormData,
): Promise<string | null> {
  const parsed = prolongationSchema.safeParse({
    etablissementId: formData.get('etablissementId'),
    jours: formData.get('jours'),
    motif: formData.get('motif'),
  });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? 'Formulaire invalide';
  }

  try {
    await prolongerEssai(parsed.data.etablissementId, parsed.data.jours, parsed.data.motif);
  } catch (e) {
    return e instanceof Error ? e.message : 'Erreur lors de la prolongation';
  }

  revalidatePath('/super-admin/abonnements');
  return null;
}

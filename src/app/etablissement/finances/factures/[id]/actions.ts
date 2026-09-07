'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { modifierLignesFacture, annulerFacture } from '@/services/facture';
import { enregistrerPaiement, annulerPaiement } from '@/services/paiement';
import { genererRecuPaiement } from '@/services/recu';
import { getUrlTelechargementDocument } from '@/services/document';
import { executerUneSeuleFois } from '@/services/synchronisation';
import { messageErreur } from '@/lib/offline/operations';

export interface ActionResult {
  error: string | null;
  url?: string;
}

const MODES = ['ESPECES', 'CHEQUE', 'VIREMENT', 'MOBILE_MONEY', 'AUTRE'] as const;

const versementSchema = z.object({
  factureId: z.string().uuid('Facture requise'),
  montant: z.coerce.number().positive('Le montant doit être strictement positif'),
  modePaiement: z.enum(MODES, { errorMap: () => ({ message: 'Mode de paiement requis' }) }),
  reference: z.string().optional(),
  datePaiement: z.string().optional(),
  // Fabriquee par le client avant l'envoi, conservee a travers la coupure.
  // Absente d'une saisie en ligne ordinaire.
  cleOperation: z.string().uuid().optional(),
});

/** Enregistre un versement puis rafraîchit la facture et le suivi. */
export async function enregistrerVersementAction(
  _prevState: string | null,
  formData: FormData,
): Promise<string | null> {
  const cleBrute = formData.get('cleOperation');
  const parsed = versementSchema.safeParse({
    factureId: formData.get('factureId'),
    montant: formData.get('montant'),
    modePaiement: formData.get('modePaiement'),
    reference: formData.get('reference'),
    datePaiement: formData.get('datePaiement'),
    cleOperation: typeof cleBrute === 'string' && cleBrute ? cleBrute : undefined,
  });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? 'Formulaire invalide';
  }

  const encaisser = () =>
    enregistrerPaiement({
      factureId: parsed.data.factureId,
      montant: parsed.data.montant,
      modePaiement: parsed.data.modePaiement,
      reference: parsed.data.reference || null,
      // Le DatePicker soumet un ISO yyyy-MM-dd : on encaisse à midi UTC pour
      // qu'un décalage de fuseau ne fasse pas basculer la date d'un jour.
      datePaiement: parsed.data.datePaiement ? `${parsed.data.datePaiement}T12:00:00Z` : null,
    });

  try {
    // Le cas qui justifie tout le socle d'idempotence : sans cle, un versement
    // rejoue apres une coupure encaisse deux fois. La famille aurait paye une
    // fois et la facture serait soldee deux, ce qui ne se decouvre qu'au
    // recouvrement — et se corrige a la main.
    if (parsed.data.cleOperation) {
      await executerUneSeuleFois(parsed.data.cleOperation, 'PAIEMENT', encaisser);
    } else {
      await encaisser();
    }
  } catch (e) {
    return messageErreur(e);
  }

  revalidatePath(`/etablissement/finances/factures/${parsed.data.factureId}`);
  revalidatePath('/etablissement/finances/factures');
  revalidatePath('/etablissement/finances/paiements');
  return null;
}

export async function annulerVersementAction(
  paiementId: string,
  factureId: string,
  motif: string,
): Promise<string | null> {
  if (!z.string().uuid().safeParse(paiementId).success) return 'Versement invalide';

  try {
    await annulerPaiement(paiementId, motif || undefined);
  } catch (e) {
    return e instanceof Error ? e.message : "Erreur lors de l'annulation du versement";
  }

  revalidatePath(`/etablissement/finances/factures/${factureId}`);
  revalidatePath('/etablissement/finances/factures');
  revalidatePath('/etablissement/finances/paiements');
  return null;
}

const lignesSchema = z.object({
  factureId: z.string().uuid('Facture requise'),
  lignes: z
    .array(
      z.object({
        typeFraisId: z.string().uuid('Type de frais requis'),
        designation: z.string().min(1, 'Désignation requise'),
        montant: z.coerce.number().min(0, 'Montant invalide'),
      }),
    )
    .max(50, 'Trop de lignes'),
});

/** Remplace les lignes de la facture (remise, frais spécial, cas particulier). */
export async function enregistrerLignesAction(
  factureId: string,
  lignes: { typeFraisId: string; designation: string; montant: number }[],
): Promise<string | null> {
  const parsed = lignesSchema.safeParse({ factureId, lignes });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? 'Lignes invalides';
  }

  try {
    await modifierLignesFacture(parsed.data.factureId, parsed.data.lignes);
  } catch (e) {
    return e instanceof Error ? e.message : 'Erreur lors de la mise à jour des lignes';
  }

  revalidatePath(`/etablissement/finances/factures/${factureId}`);
  revalidatePath('/etablissement/finances/factures');
  return null;
}

export async function annulerFactureAction(factureId: string): Promise<string | null> {
  if (!z.string().uuid().safeParse(factureId).success) return 'Facture invalide';

  try {
    await annulerFacture(factureId);
  } catch (e) {
    return e instanceof Error ? e.message : "Erreur lors de l'annulation de la facture";
  }

  revalidatePath(`/etablissement/finances/factures/${factureId}`);
  revalidatePath('/etablissement/finances/factures');
  return null;
}

/** Génère le reçu PDF d'un versement et renvoie une URL de téléchargement. */
export async function genererRecuAction(
  paiementId: string,
  factureId: string,
): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(paiementId).success) return { error: 'Versement invalide' };

  try {
    const document = await genererRecuPaiement(paiementId);
    const url = await getUrlTelechargementDocument(document.id);
    revalidatePath(`/etablissement/finances/factures/${factureId}`);
    revalidatePath('/etablissement/finances/paiements');
    return { error: null, url };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur lors de la génération du reçu' };
  }
}

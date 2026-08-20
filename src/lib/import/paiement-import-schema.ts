import { z } from 'zod';

/**
 * Gabarit de colonnes fixe pour l'import de l'historique financier (Phase 6).
 * Même parti pris que les imports élèves et enseignants : pas de mapping
 * dynamique en UI, la première ligne doit reprendre exactement ces en-têtes.
 *
 * Un import reprend des versements **déjà encaissés** avant la mise en
 * service du logiciel. L'élève est identifié par son matricule, et la facture
 * ciblée est celle de l'année scolaire d'import — il n'y a qu'une facture par
 * élève et par année (générée à l'inscription).
 */
export const PAIEMENT_IMPORT_COLUMNS = [
  'matricule',
  'montant',
  'date_paiement',
  'mode_paiement',
  'reference',
] as const;

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const paiementImportLigneSchema = z
  .object({
    matricule: z.string().min(1, 'Matricule requis'),
    montant: z.coerce
      .number({ invalid_type_error: 'Montant invalide' })
      .positive('Le montant doit être strictement positif'),
    date_paiement: z
      .string()
      .regex(isoDateRegex, 'Date de versement invalide (format attendu: AAAA-MM-JJ)'),
    mode_paiement: z.enum(['ESPECES', 'CHEQUE', 'VIREMENT', 'MOBILE_MONEY', 'AUTRE'], {
      errorMap: () => ({
        message: 'Mode invalide (ESPECES, CHEQUE, VIREMENT, MOBILE_MONEY ou AUTRE)',
      }),
    }),
    reference: z.string().optional(),
  })
  .refine((l) => l.mode_paiement === 'ESPECES' || Boolean(l.reference?.trim()), {
    message: 'Référence requise pour un chèque, un virement ou un Mobile Money',
    path: ['reference'],
  });

export type PaiementImportLigne = z.infer<typeof paiementImportLigneSchema>;

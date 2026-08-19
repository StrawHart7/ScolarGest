import { z } from 'zod';

/**
 * Gabarit de colonnes fixe pour l'import Excel élèves + responsables (Phase
 * 2). Pas de mapping dynamique en UI : la première ligne du fichier doit
 * reprendre exactement ces en-têtes.
 */
export const ELEVE_IMPORT_COLUMNS = [
  'nom',
  'prenoms',
  'sexe',
  'date_naissance',
  'lieu_naissance',
  'nationalite',
  'ancien_matricule',
  'classe',
  'nom_responsable',
  'prenoms_responsable',
  'telephone_responsable',
  'email_responsable',
  'type_responsable',
  'lien_parente',
  'principal',
] as const;

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const eleveImportLigneSchema = z.object({
  nom: z.string().min(1, 'Nom requis'),
  prenoms: z.string().min(1, 'Prénoms requis'),
  sexe: z.enum(['M', 'F'], { errorMap: () => ({ message: 'Sexe invalide (M ou F attendu)' }) }),
  date_naissance: z
    .string()
    .regex(isoDateRegex, 'Date de naissance invalide (format attendu: AAAA-MM-JJ)'),
  lieu_naissance: z.string().optional(),
  nationalite: z.string().optional(),
  ancien_matricule: z.string().optional(),
  classe: z.string().min(1, 'Classe requise (nom exact de la classe)'),
  nom_responsable: z.string().min(1, 'Nom du responsable requis'),
  prenoms_responsable: z.string().min(1, 'Prénoms du responsable requis'),
  telephone_responsable: z.string().optional(),
  email_responsable: z.string().email('Email invalide').optional().or(z.literal('')),
  type_responsable: z.enum(['PERE', 'MERE', 'TUTEUR', 'AUTRE'], {
    errorMap: () => ({ message: 'Type de responsable invalide' }),
  }),
  lien_parente: z.string().min(1, 'Lien de parenté requis'),
  principal: z
    .union([z.literal('OUI'), z.literal('NON'), z.literal(''), z.undefined()])
    .optional()
    .transform((v) => v === 'OUI'),
});

export type EleveImportLigne = z.infer<typeof eleveImportLigneSchema>;

export interface LigneErreur {
  ligne: number;
  champ: string;
  message: string;
}

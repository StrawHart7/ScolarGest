import { z } from 'zod';

/**
 * Gabarit de colonnes fixe pour l'import Excel enseignants + affectations
 * (Phase 3). Pas de mapping dynamique en UI : la première ligne du fichier
 * doit reprendre exactement ces en-têtes. Une ligne = un enseignant + une
 * affectation (classe × matière) ; le même enseignant peut réapparaître sur
 * plusieurs lignes pour ses affectations suivantes (regroupées par email).
 */
export const ENSEIGNANT_IMPORT_COLUMNS = [
  'nom',
  'prenoms',
  'sexe',
  'email',
  'telephone',
  'date_naissance',
  'date_embauche',
  'matricule_ancien',
  'classe',
  'matiere',
] as const;

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const enseignantImportLigneSchema = z.object({
  nom: z.string().min(1, 'Nom requis'),
  prenoms: z.string().min(1, 'Prénoms requis'),
  sexe: z.enum(['M', 'F'], { errorMap: () => ({ message: 'Sexe invalide (M ou F attendu)' }) }),
  email: z.string().min(1, 'Email requis').email('Email invalide'),
  telephone: z.string().optional(),
  date_naissance: z
    .union([z.string().regex(isoDateRegex, 'Date de naissance invalide (format attendu: AAAA-MM-JJ)'), z.literal('')])
    .optional(),
  date_embauche: z
    .union([z.string().regex(isoDateRegex, "Date d'embauche invalide (format attendu: AAAA-MM-JJ)"), z.literal('')])
    .optional(),
  matricule_ancien: z.string().optional(),
  classe: z.string().min(1, 'Classe requise (nom exact de la classe)'),
  matiere: z.string().min(1, 'Matière requise'),
});

export type EnseignantImportLigne = z.infer<typeof enseignantImportLigneSchema>;

export interface LigneErreur {
  ligne: number;
  champ: string;
  message: string;
}

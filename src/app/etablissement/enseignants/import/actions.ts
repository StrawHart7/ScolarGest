'use server';

import { z } from 'zod';
import {
  parseFichierExcel,
  validerLignes,
  importerLignesValides,
} from '@/services/import-enseignants';
import type { ImportRapport } from '@/services/import-enseignants';
import type { LigneErreur } from '@/lib/import/enseignant-import-schema';

export interface ImportActionResult {
  ok: boolean;
  message?: string;
  erreursValidation?: LigneErreur[];
  rapport?: ImportRapport;
}

const anneeSchema = z.string().uuid();

export async function importerFichierEnseignants(formData: FormData): Promise<ImportActionResult> {
  const anneeScolaireId = anneeSchema.safeParse(formData.get('anneeScolaireId'));
  if (!anneeScolaireId.success) {
    return { ok: false, message: 'Année scolaire manquante ou invalide' };
  }

  const file = formData.get('fichier');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: 'Aucun fichier sélectionné' };
  }

  let buffer: ArrayBuffer;
  try {
    buffer = await file.arrayBuffer();
  } catch {
    return { ok: false, message: 'Impossible de lire le fichier' };
  }

  let lignesBrutes;
  try {
    lignesBrutes = parseFichierExcel(Buffer.from(buffer));
  } catch {
    return { ok: false, message: 'Fichier Excel illisible ou corrompu' };
  }

  if (lignesBrutes.length === 0) {
    return { ok: false, message: 'Le fichier ne contient aucune ligne de données' };
  }

  const { valides, erreurs } = validerLignes(lignesBrutes);

  if (valides.length === 0) {
    return { ok: false, message: 'Aucune ligne valide dans le fichier', erreursValidation: erreurs };
  }

  try {
    const rapport = await importerLignesValides(valides, anneeScolaireId.data);
    return { ok: true, erreursValidation: erreurs, rapport };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur lors de l'import" };
  }
}

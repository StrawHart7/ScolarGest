'use server';

import { z } from 'zod';
import { validerPassageCohorte, type ResultatPassageLigne } from '@/services/passage-annee';

const decisionSchema = z.object({
  eleveId: z.string().uuid(),
  inscriptionSourceId: z.string().uuid(),
  decision: z.enum(['ADMIS', 'REDOUBLANT', 'DEPART']),
  classeCibleId: z.string().uuid().optional(),
});

const schema = z.object({
  anneeCibleId: z.string().uuid(),
  decisions: z.array(decisionSchema).min(1),
});

export interface ValiderPassageResult {
  ok: boolean;
  message?: string;
  resultats?: ResultatPassageLigne[];
}

export async function validerPassageCohorteAction(input: unknown): Promise<ValiderPassageResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Formulaire invalide' };
  }

  for (const d of parsed.data.decisions) {
    if ((d.decision === 'ADMIS' || d.decision === 'REDOUBLANT') && !d.classeCibleId) {
      return { ok: false, message: `Classe cible requise pour l'élève ${d.eleveId}` };
    }
  }

  try {
    const resultats = await validerPassageCohorte(parsed.data.anneeCibleId, parsed.data.decisions);
    return { ok: true, resultats };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Erreur lors du passage de cohorte' };
  }
}

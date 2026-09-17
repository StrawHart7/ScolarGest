'use server';

import { revalidatePath } from 'next/cache';
import { reconduireAnnee } from '@/services/reconduction';

export interface ResultatReprise {
  ok: boolean;
  message: string;
}

/**
 * Reprend affectations, titularités et emploi du temps de l'année précédente.
 *
 * Rend un message plutôt que de lever : l'appelant est un composant client, et
 * une Server Action interrompue peut se résoudre sur `undefined` — voir
 * `src/app/demarrage/appel-action.ts`. Le composant traite ce cas.
 *
 * Le bilan est chiffré dans le message, y compris ce qui a été **écarté** : une
 * reprise qui annonce « 98 affectations » sans dire que 15 ont été laissées de
 * côté laisserait croire à un travail complet.
 */
export async function reprendreAnneePrecedente(anneeScolaireId: string): Promise<ResultatReprise> {
  try {
    const bilan = await reconduireAnnee(anneeScolaireId);

    const faits: string[] = [];
    if (bilan.affectations > 0) faits.push(`${bilan.affectations} affectation(s)`);
    if (bilan.titularites > 0) faits.push(`${bilan.titularites} professeur(s) principal(aux)`);
    if (bilan.creneaux > 0) faits.push(`${bilan.creneaux} créneau(x) d'emploi du temps`);

    revalidatePath('/etablissement/annees-scolaires');
    revalidatePath(`/etablissement/annees-scolaires/${anneeScolaireId}`);

    if (faits.length === 0) {
      return {
        ok: true,
        message:
          bilan.ignores > 0
            ? `Rien de nouveau : les ${bilan.ignores} lignes de l'an dernier existent déjà sur cette année, ou concernent des enseignants partis.`
            : "Rien à reprendre : l'année précédente n'avait ni affectation, ni professeur principal, ni emploi du temps.",
      };
    }

    const ecartes =
      bilan.ignores > 0
        ? ` ${bilan.ignores} ligne(s) écartée(s) : déjà présentes, enseignant parti, ou classe sans équivalent.`
        : '';

    return { ok: true, message: `Repris : ${faits.join(', ')}.${ecartes}` };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : 'La reprise a échoué.',
    };
  }
}

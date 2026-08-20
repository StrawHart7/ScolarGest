'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { definirCoefficients, type CoefficientSaisi } from '@/services/coefficient';

const schema = z.object({
  anneeScolaireId: z.string().uuid('Année scolaire requise'),
  serieId: z.string().uuid().nullable(),
});

/**
 * Enregistre d'un coup tous les coefficients affichés. Les champs sont nommés
 * `coefficient:<programmeEtablissementId>`, ce qui évite un tableau d'index
 * fragile entre le rendu serveur et la soumission.
 */
export async function definirCoefficientsAction(
  _etatPrecedent: string | null,
  donnees: FormData,
): Promise<string | null> {
  const parsed = schema.safeParse({
    anneeScolaireId: donnees.get('anneeScolaireId'),
    serieId: donnees.get('serieId') || null,
  });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? 'Formulaire invalide';
  }

  const saisies: CoefficientSaisi[] = [];
  for (const [cle, valeur] of donnees.entries()) {
    if (!cle.startsWith('coefficient:')) continue;
    const texte = String(valeur).trim();
    // Un champ laissé vide signifie « pas de coefficient défini » : on ne le
    // force pas à 0, ce qui exclurait silencieusement la matière du calcul.
    if (texte === '') continue;
    const nombre = Number(texte);
    if (!Number.isFinite(nombre) || nombre < 0) {
      return 'Chaque coefficient doit être un nombre positif ou nul.';
    }
    saisies.push({ programmeEtablissementId: cle.slice('coefficient:'.length), coefficient: nombre });
  }

  if (saisies.length === 0) {
    return 'Aucun coefficient saisi.';
  }

  try {
    await definirCoefficients(parsed.data.anneeScolaireId, parsed.data.serieId, saisies);
  } catch (erreur) {
    return erreur instanceof Error
      ? erreur.message
      : "Erreur lors de l'enregistrement des coefficients";
  }

  revalidatePath('/etablissement/programme/coefficients');
  return 'OK';
}

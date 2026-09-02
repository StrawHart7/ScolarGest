'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { definirCoefficients, type CoefficientSaisi } from '@/services/coefficient';
import { appliquerCoefficientsOfficiels } from '@/services/matiere-officielle';

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

/**
 * Recopie le barème du ministère dans l'année scolaire en cours.
 *
 * Distincte de l'enregistrement du formulaire, et pas par confort : le
 * formulaire soumet ce qui est **affiché**, c'est-à-dire les valeurs déjà
 * enregistrées. Un bouton « Enregistrer » ne peut donc pas aligner sur le
 * barème national — il réécrirait à l'identique. Il faut une action qui va
 * chercher les valeurs officielles.
 *
 * Toutes les combinaisons niveau/série ouvertes cette année sont traitées d'un
 * coup : aligner série par série obligerait à parcourir l'écran huit fois pour
 * un lycée complet, et laisserait des trous invisibles.
 */
export async function appliquerBaremeOfficielAction(
  _etatPrecedent: string | null,
  donnees: FormData,
): Promise<string | null> {
  const anneeScolaireId = String(donnees.get('anneeScolaireId') ?? '');
  if (!z.string().uuid().safeParse(anneeScolaireId).success) {
    return 'Année scolaire requise';
  }

  try {
    const { appliques } = await appliquerCoefficientsOfficiels(anneeScolaireId);
    revalidatePath('/etablissement/programme/coefficients');
    return appliques === 0
      ? 'Aucun coefficient national ne correspond à ce programme.'
      : `Barème national appliqué : ${appliques} coefficient${appliques > 1 ? 's' : ''}.`;
  } catch (e) {
    // Les erreurs Supabase ne sont pas des `Error` : `instanceof` y est
    // toujours faux et masquerait la cause réelle derrière un message
    // générique.
    if (e && typeof e === 'object' && 'message' in e) {
      return String((e as { message: unknown }).message);
    }
    return 'Impossible d’appliquer le barème national.';
  }
}

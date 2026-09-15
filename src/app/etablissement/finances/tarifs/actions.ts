'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createTarif } from '@/services/tarif';
import { createTypeFrais, listTypesFrais } from '@/services/type-frais';
// Dans `lib/` et non ici : un fichier `'use server'` ne peut exporter que des
// fonctions asynchrones, une constante y ferait échouer le build.
import { NOUVEAU_TYPE_FRAIS } from '@/lib/frais';

const schema = z.object({
  anneeScolaireId: z.string().uuid('Année scolaire requise'),
  classeId: z.string().uuid('Classe requise'),
  typeFraisId: z.string().min(1, 'Type de frais requis'),
  /**
   * `.nullish()` et non `.optional()`.
   *
   * Le champ n'est rendu que si l'on a choisi « Un autre frais… ». Absent du
   * formulaire, `formData.get` rend **`null`**, jamais `undefined` — et
   * `.optional()` accepte le second mais refuse le premier. Le formulaire
   * répondait donc « Expected string, received null » dès qu'on choisissait un
   * frais existant, c'est-à-dire dans le cas ordinaire.
   */
  nouveauTypeFrais: z.string().nullish(),
  montant: z.coerce.number().min(0, 'Montant invalide'),
});

/**
 * Création uniquement : un `TarifScolaire` est immuable (doc 08 §6). Il n'y a
 * volontairement aucune action de modification ni de suppression ici.
 *
 * ## Le type de frais se crée d'ici
 *
 * « Types de frais » et « Tarifs » étaient deux écrans, et il fallait les
 * traverser dans le bon ordre : créer « Scolarité » quelque part, puis revenir
 * dire qu'elle coûte 150 000 en 6ème. Deux tables, deux pages — alors que le
 * directeur fait un seul geste et le dit en une phrase.
 *
 * Retirer l'entrée du menu, comme fait le 2026-09-15, n'était que la moitié du
 * travail : l'écran restait à part et le détour aussi.
 *
 * Le nom est **repris s'il existe déjà**, sans erreur : quelqu'un qui tape
 * « Scolarité » alors qu'elle existe veut fixer son tarif, pas apprendre qu'il
 * a fait doublon. La comparaison ignore la casse et les espaces de bord —
 * « scolarité » et « Scolarité » sont le même frais pour une école.
 */
export async function creerTarifAction(
  _prevState: string | null,
  formData: FormData,
): Promise<string | null> {
  const parsed = schema.safeParse({
    anneeScolaireId: formData.get('anneeScolaireId'),
    classeId: formData.get('classeId'),
    typeFraisId: formData.get('typeFraisId'),
    nouveauTypeFrais: formData.get('nouveauTypeFrais'),
    montant: formData.get('montant'),
  });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? 'Il manque une information : vérifiez les champs signalés, puis réessayez.';
  }

  let typeFraisId = parsed.data.typeFraisId;

  if (typeFraisId === NOUVEAU_TYPE_FRAIS) {
    const nom = (parsed.data.nouveauTypeFrais ?? '').trim();
    if (!nom) return 'Donnez un nom au nouveau frais (Scolarité, Inscription, Cantine…).';

    try {
      const existants = await listTypesFrais(true);
      const dejaLa = existants.find(
        (t) => t.nom.trim().toLowerCase() === nom.toLowerCase(),
      );
      typeFraisId = dejaLa ? dejaLa.id : (await createTypeFrais({ nom })).id;
    } catch (e) {
      return e instanceof Error ? e.message : 'Erreur lors de la création du type de frais';
    }
  }

  try {
    await createTarif({ ...parsed.data, typeFraisId });
  } catch (e) {
    return e instanceof Error ? e.message : 'Erreur lors de la création du tarif';
  }

  revalidatePath('/etablissement/finances/tarifs');
  // 'OK' plutôt que null : le formulaire en modal doit pouvoir distinguer
  // « rien ne s'est encore passé » de « succès » pour se fermer.
  return 'OK';
}

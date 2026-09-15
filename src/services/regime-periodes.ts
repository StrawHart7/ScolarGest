import { createClient } from '@/lib/supabase/server';
import { requireRole } from './authorization';
import { getTenantContext } from './tenant';
import { auditLog } from './audit';
import { REGIME_PAR_DEFAUT, type RegimePeriodes } from '@/lib/periodes';

/**
 * Trimestre ou semestre.
 *
 * Certains lycées togolais découpent leur année en deux périodes et non en
 * trois. Le choix se fait à l'onboarding, et vaut pour **tout**
 * l'établissement — l'utilisateur l'a tranché le 2026-09-15 : aucun mélange,
 * un complexe collège-lycée est entièrement à l'un ou à l'autre.
 *
 * L'énumération `periode` ne change pas : une école au semestre emploie
 * `TRIMESTRE_1` et `TRIMESTRE_2`, jamais `TRIMESTRE_3`. Voir
 * `src/lib/periodes.ts` et la migration `20260915160508`.
 */

/**
 * Le régime de l'établissement courant.
 *
 * Ne lève pas : un régime illisible retombe sur le trimestre, qui est le cas
 * de toutes les écoles en base. Un bandeau manquant vaut mieux qu'une
 * application inaccessible — même parti pris que `AbonnementBanner`, et il
 * compte davantage ici puisque cette lecture a lieu dans le layout, donc sur
 * **chaque** page de l'espace école.
 */
export async function getRegimePeriodes(): Promise<RegimePeriodes> {
  try {
    const ctx = await getTenantContext();
    if (!ctx.etablissementId) return REGIME_PAR_DEFAUT;

    const supabase = createClient();
    const { data, error } = await supabase
      .from('etablissement')
      .select('"regimePeriodes"')
      .eq('id', ctx.etablissementId)
      .maybeSingle();
    if (error) return REGIME_PAR_DEFAUT;

    return (data as { regimePeriodes: RegimePeriodes } | null)?.regimePeriodes ?? REGIME_PAR_DEFAUT;
  } catch {
    return REGIME_PAR_DEFAUT;
  }
}

/**
 * Fixe le régime de l'établissement.
 *
 * **Refusé dès qu'une évaluation existe sur l'année active**, et c'est le
 * point délicat. Basculer au semestre après avoir noté un premier trimestre
 * renommerait des périodes déjà imprimées sur des bulletins remis aux
 * familles : « 1er trimestre » deviendrait « 1er semestre » rétroactivement,
 * et la troisième période saisie deviendrait inatteignable — ses notes
 * resteraient en base, comptées dans la moyenne annuelle, mais aucun écran ne
 * les proposerait plus.
 *
 * Le choix se fait donc à l'onboarding, avant toute note. Une école qui se
 * trompe et l'a compris tôt peut encore corriger ; une école qui a noté doit
 * passer par le support, qui verra ce que ses données permettent.
 */
export async function definirRegimePeriodes(regime: RegimePeriodes): Promise<void> {
  const ctx = await requireRole('DIRECTEUR');
  const supabase = createClient();

  const actuel = await getRegimePeriodes();
  if (actuel === regime) return;

  // `evaluation` ne porte pas d'`etablissementId` — comme `note` et
  // `paiement`. On borne par les classes de l'établissement : filtrer
  // directement ferait **échouer** la requête, pas rendre zéro.
  const { data: classes, error: erreurClasses } = await supabase
    .from('classe')
    .select('id')
    .eq('etablissementId', ctx.etablissementId);
  if (erreurClasses) throw erreurClasses;

  const classeIds = ((classes ?? []) as { id: string }[]).map((c) => c.id);
  if (classeIds.length > 0) {
    const { count, error } = await supabase
      .from('evaluation')
      .select('id', { count: 'exact', head: true })
      .in('classeId', classeIds);
    if (error) throw error;
    if ((count ?? 0) > 0) {
      throw new Error(
        'Des notes ont déjà été saisies cette année : le découpage ne peut plus être modifié. Écrivez au support.',
      );
    }
  }

  const { error } = await supabase
    .from('etablissement')
    .update({ regimePeriodes: regime })
    .eq('id', ctx.etablissementId);
  if (error) throw error;

  await auditLog({
    action: 'DEFINIR_REGIME_PERIODES',
    module: 'structure',
    objetType: 'Etablissement',
    objetId: ctx.etablissementId,
    ancienneValeur: { regimePeriodes: actuel },
    nouvelleValeur: { regimePeriodes: regime },
  });
}

import { createClient } from '@/lib/supabase/server';
import { memoiserParRequete } from '@/lib/memo';
import { requireRole } from './authorization';
import { getTenantContext } from './tenant';
import { auditLog } from './audit';
import {
  CYCLE_AU_CHOIX,
  REGIME_PAR_DEFAUT,
  type NomCycle,
  type RegimePeriodes,
} from '@/lib/periodes';

/**
 * Trimestre ou semestre — et le choix n'appartient qu'au lycée.
 *
 * Certains lycées togolais découpent leur année en deux périodes et non en
 * trois. **Le collège, jamais** : il est au trimestre, toujours. Corrigé le
 * 2026-09-15 par l'utilisateur, qui avait d'abord dit « aucun mélange, toute
 * l'école à l'un ou à l'autre » puis précisé que la différenciation est
 * propre au lycée. Les deux règles ne pouvaient pas tenir ensemble : un
 * complexe collège-lycée au semestre porte forcément les deux découpages.
 *
 * `etablissement."regimePeriodes"` décrit donc **le lycée**, et lui seul. La
 * colonne ne bouge pas ; c'est son sens qui se rétrécit.
 *
 * L'énumération `periode` ne change pas non plus : une classe au semestre
 * emploie `TRIMESTRE_1` et `TRIMESTRE_2`, jamais `TRIMESTRE_3`. Voir
 * `src/lib/periodes.ts` et la migration `20260915160508`.
 */

export interface ContexteRegime {
  /** Le régime du lycée. Sans effet sur les autres cycles. */
  regimeLycee: RegimePeriodes;
  /** Les cycles ouverts par l'école, pour départager quand aucune classe n'est en vue. */
  cyclesActifs: NomCycle[];
}

const CONTEXTE_PAR_DEFAUT: ContexteRegime = {
  regimeLycee: REGIME_PAR_DEFAUT,
  cyclesActifs: [],
};

/**
 * Le régime du lycée et les cycles ouverts, en **un seul aller-retour**.
 *
 * Les deux sont lus ensemble par une ressource embarquée plutôt que par deux
 * requêtes : cette lecture a lieu dans `AppLayout`, donc sur chaque page de
 * l'espace école. Y ajouter un second appel reviendrait à reprendre d'une main
 * ce que la correction des politiques RLS vient de rendre de l'autre.
 *
 * Mémoïsé par requête : plusieurs composants d'une même page peuvent le
 * demander sans le payer deux fois.
 *
 * Ne lève pas. Un contexte illisible retombe sur le trimestre, qui est le cas
 * de toutes les écoles en base — même parti pris que `AbonnementBanner`, et il
 * compte davantage ici puisqu'un échec emporterait le layout entier.
 */
export const getContexteRegime = memoiserParRequete(
  async function getContexteRegime(): Promise<ContexteRegime> {
    try {
      const ctx = await getTenantContext();
      if (!ctx.etablissementId) return CONTEXTE_PAR_DEFAUT;

      const supabase = createClient();
      const { data, error } = await supabase
        .from('etablissement')
        .select('"regimePeriodes", cycle_etablissement(actif, cycle(nom))')
        .eq('id', ctx.etablissementId)
        .maybeSingle();
      if (error) return CONTEXTE_PAR_DEFAUT;

      const ligne = data as {
        regimePeriodes: RegimePeriodes | null;
        cycle_etablissement: { actif: boolean; cycle: { nom: string } | null }[] | null;
      } | null;
      if (!ligne) return CONTEXTE_PAR_DEFAUT;

      const cyclesActifs = (ligne.cycle_etablissement ?? [])
        .filter((c) => c.actif && c.cycle?.nom)
        .map((c) => c.cycle!.nom as NomCycle);

      return {
        regimeLycee: ligne.regimePeriodes ?? REGIME_PAR_DEFAUT,
        cyclesActifs,
      };
    } catch {
      return CONTEXTE_PAR_DEFAUT;
    }
  },
);

/**
 * `getRegimePeriodes` a été **supprimée** le 2026-09-15, et c'est délibéré.
 *
 * Son nom disait « le régime de l'école » ; depuis que le choix appartient au
 * lycée, elle rendait autre chose que ce qu'elle annonçait. Une fonction dont
 * le nom ment est pire qu'une fonction absente : elle sera appelée de bonne foi
 * par le prochain écran, qui nommera « semestre » les trimestres d'une classe
 * de 5e sans que rien ne le signale.
 *
 * Les appelants passent donc par `getContexteRegime()` et croisent eux-mêmes le
 * `regimeLycee` avec le cycle de leur classe, via `regimeDuCycle`. C'est deux
 * lignes de plus à l'appel, et l'oubli devient visible à la lecture.
 */

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

  const contexte = await getContexteRegime();
  const actuel = contexte.regimeLycee;
  if (actuel === regime) return;

  // Le semestre n'existe qu'au lycée. Une école qui n'en a pas ouvert n'a
  // aucune classe à qui ce choix s'appliquerait : l'accepter poserait en base
  // une valeur sans effet, que personne ne saurait relire dans six mois — et
  // qui prendrait effet d'un coup, silencieusement, le jour où l'école
  // ouvrirait son lycée. L'écran ne propose déjà pas la question dans ce cas ;
  // la garde est ici parce que le choix arrive de l'appelant.
  if (regime === 'SEMESTRE' && !contexte.cyclesActifs.includes(CYCLE_AU_CHOIX)) {
    throw new Error(
      "Le découpage en semestres ne concerne que le lycée. Activez d'abord le cycle lycée dans la configuration de votre établissement.",
    );
  }

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

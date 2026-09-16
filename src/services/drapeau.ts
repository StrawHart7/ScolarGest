import { createClient } from '@/lib/supabase/server';
import { requireRole } from './authorization';
import { reessayerLecture } from '@/lib/reessayer';
import type { CodeDrapeau } from '@/lib/drapeaux';

/**
 * Le produit demande à la base si une fonctionnalité est ouverte pour l'école
 * qui parle.
 *
 * La décision entière vit dans `public.drapeau_actif` (migration
 * `20260913013344`), et l'ordre y est : arrêt d'urgence, puis ciblage explicite
 * de l'école, puis ouverture progressive, puis défaut du drapeau. Ne pas
 * reproduire cet ordre ici — deux copies d'une règle de priorité divergent, et
 * celle qui est fausse est toujours celle qu'on ne relit pas.
 *
 * `drapeau_actif` est `security definer` : elle lit `drapeau` et
 * `drapeau_etablissement` sans que l'école n'y ait le moindre droit. C'est
 * voulu — un directeur qui pourrait lire la table pourrait aussi apprendre
 * qu'il est ciblé, et une école qui pourrait l'écrire se rouvrirait ce que la
 * plateforme vient de lui couper.
 *
 * ## Pourquoi l'échec lève, plutôt que de trancher à la place de la base
 *
 * Les deux replis silencieux sont pires que l'aveu :
 *
 * - **Laisser passer** rendrait l'interrupteur d'arrêt douteux au seul moment
 *   où il sert, puisqu'on l'actionne précisément quand quelque chose va mal.
 * - **Refuser** ferait qu'un `504` — un à quatre par heure sur cette
 *   passerelle, voir `src/lib/reessayer.ts` — priverait une école neuve de tout
 *   son barème national pendant son démarrage, en annonçant zéro coefficient
 *   projeté comme si c'était le résultat. C'est exactement le défaut que ce
 *   dépôt a payé sur `bilanCloture` : un zéro crédible avant un geste qu'on ne
 *   refait pas.
 *
 * Donc une reprise — un à-coup de passerelle ne mérite pas un échec — puis on
 * lève. L'appelant du démarrage attrape déjà et propose de reprendre depuis
 * l'écran du programme : la voie de secours existe, autant s'en servir.
 */
export async function drapeauActif(code: CodeDrapeau): Promise<boolean> {
  await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE', 'ENSEIGNANT');
  const supabase = createClient();

  const { data, error } = await reessayerLecture<boolean | null>(async () => {
    const reponse = await supabase.rpc('drapeau_actif', { p_code: code });
    return { data: reponse.data as boolean | null, error: reponse.error };
  });
  if (error) throw error;

  // `=== true` et non une conversion : `drapeau_actif` rend un booléen, et un
  // `null` signifierait que la réponse n'est pas celle qu'on croit lire.
  return data === true;
}

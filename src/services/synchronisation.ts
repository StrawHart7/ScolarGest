import { createClient } from '@/lib/supabase/server';
import { requireRole } from './authorization';
import type { EtatOperation, TypeOperation } from '@/lib/offline/operations';

export type { EtatOperation, TypeOperation };

/**
 * Applique une ecriture differee **au plus une fois**.
 *
 * Une file d'attente hors ligne rejoue : c'est sa raison d'etre. Elle rejoue
 * quand la reponse s'est perdue en chemin, quand l'utilisateur recharge, quand
 * deux onglets reviennent en ligne ensemble. Pour `saisirNoteAction`, rejouer
 * est sans consequence — c'est un upsert sur `(evaluationId, eleveId)`. Pour un
 * versement, rejouer encaisse deux fois.
 *
 * Le contrat est donc : le client fabrique une cle **avant** d'agir, la garde a
 * travers la coupure, et la renvoie a chaque tentative. Le serveur n'applique
 * `travail` que pour la premiere, et rend a toutes les suivantes le resultat de
 * celle-la — un numero de recu, un identifiant de paiement. Repondre seulement
 * « deja fait » ne suffirait pas : le client ne saurait pas quel document
 * montrer.
 *
 * La reclamation passe par `fn_reclamer_operation`, ou c'est **l'insertion qui
 * verrouille**. Un « lire puis ecrire si absent » cote application laisserait
 * deux executions concurrentes passer toutes les deux.
 */
export async function executerUneSeuleFois<T>(
  cle: string,
  type: TypeOperation,
  travail: () => Promise<T>,
): Promise<EtatOperation<T>> {
  // Les quatre roles ecole peuvent avoir des ecritures en attente : un
  // enseignant ses notes, une secretaire un versement. Les enumerer, plutot
  // que d'appeler la garde sans argument — sans argument elle ne laisse
  // passer que le SUPER_ADMIN, et bloquerait toute la file.
  await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE', 'ENSEIGNANT');
  const supabase = createClient();

  const { data, error } = await supabase
    .rpc('fn_reclamer_operation', { p_cle: cle, p_type: type })
    .single<{ rejeu: boolean; achevee: boolean; resultat: T | null }>();
  if (error) throw error;

  if (data.rejeu) {
    // Deja appliquee : on rend le resultat de la premiere fois. Si elle est
    // encore en cours ailleurs (`achevee` faux), on le dit au lieu de
    // reexecuter — la file reessaiera plus tard.
    return { rejeu: true, achevee: data.achevee, resultat: data.resultat };
  }

  let resultat: T;
  try {
    resultat = await travail();
  } catch (e) {
    // Le travail a echoue : on rend la cle a la file, sans quoi le versement
    // ne partirait jamais. L'abandon ne doit pas masquer la cause initiale,
    // c'est bien `e` qui remonte.
    await supabase.rpc('fn_abandonner_operation', { p_cle: cle });
    throw e;
  }

  const { error: erreurFin } = await supabase.rpc('fn_achever_operation', {
    p_cle: cle,
    p_resultat: resultat === undefined ? null : (resultat as unknown),
  });
  if (erreurFin) throw erreurFin;

  return { rejeu: false, achevee: true, resultat };
}

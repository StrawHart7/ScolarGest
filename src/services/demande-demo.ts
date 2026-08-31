import { createClient } from '@/lib/supabase/server';
import { requireRole } from './authorization';
import { auditLog } from './audit';

/**
 * Demandes de démo issues du formulaire public de la page d'accueil.
 *
 * La table et ses policies existent depuis la migration `0002`, mais aucun
 * écran ne les lisait : chaque prospect arrivait dans une table que personne
 * n'ouvrait. C'est le seul appel à l'action de tout le site public.
 *
 * L'écriture est publique (`demande_demo_insert_public`, y compris anonyme),
 * la lecture et la mise à jour réservées au SUPER_ADMIN. `requireRole()` sans
 * argument est donc correct ici — ce n'est pas de la donnée de tenant.
 */

export type StatutDemande = 'NOUVELLE' | 'CONTACTEE' | 'CONVERTIE' | 'REJETEE';

export const STATUTS_DEMANDE: StatutDemande[] = [
  'NOUVELLE',
  'CONTACTEE',
  'CONVERTIE',
  'REJETEE',
];

export interface DemandeDemo {
  id: string;
  nomEtablissement: string;
  nomContact: string;
  email: string;
  telephone: string | null;
  ville: string | null;
  message: string | null;
  statut: StatutDemande;
  createdAt: string;
}

const CHAMPS =
  'id, "nomEtablissement", "nomContact", email, telephone, ville, message, statut, "createdAt"';

/**
 * Toutes les demandes, les plus récentes d'abord.
 *
 * Pas de pagination : le volume attendu se compte en dizaines, et une liste
 * complète permet de chercher un prospect dont on ne sait plus la date. À
 * revoir si le formulaire attire du spam.
 */
export async function listDemandesDemo(): Promise<DemandeDemo[]> {
  await requireRole();
  const supabase = createClient();
  const { data, error } = await supabase
    .from('demande_demo')
    .select(CHAMPS)
    .order('createdAt', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as DemandeDemo[];
}

/**
 * Fait avancer une demande dans le suivi commercial.
 *
 * Journalisé : savoir qui a marqué un prospect « rejeté » et quand a de la
 * valeur dès qu'on est plus d'un à traiter la file.
 */
export async function changerStatutDemande(
  id: string,
  statut: StatutDemande,
): Promise<void> {
  await requireRole();
  const supabase = createClient();

  const { data: avant, error: erreurLecture } = await supabase
    .from('demande_demo')
    .select('statut, "nomEtablissement"')
    .eq('id', id)
    .maybeSingle();
  if (erreurLecture) throw erreurLecture;
  if (!avant) throw new Error('Demande introuvable.');

  const { error } = await supabase.from('demande_demo').update({ statut }).eq('id', id);
  if (error) throw error;

  await auditLog({
    action: 'CHANGER_STATUT_DEMANDE_DEMO',
    module: 'saas',
    objetType: 'DemandeDemo',
    objetId: id,
    ancienneValeur: { statut: (avant as { statut: string }).statut },
    nouvelleValeur: {
      statut,
      etablissement: (avant as { nomEtablissement: string }).nomEtablissement,
    },
  });
}

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantContext } from './tenant';

export interface AuditInput {
  action: string;
  module: string;
  objetType: string;
  objetId?: string;
  ancienneValeur?: unknown;
  nouvelleValeur?: unknown;
}

export async function auditLog(input: AuditInput): Promise<void> {
  const ctx = await getTenantContext();
  const supabase = createClient();
  const { error } = await supabase.from('audit_log').insert({
    etablissementId: ctx.etablissementId || null,
    userId: ctx.userId,
    action: input.action,
    module: input.module,
    objetType: input.objetType,
    objetId: input.objetId ?? null,
    ancienneValeur: input.ancienneValeur ?? null,
    nouvelleValeur: input.nouvelleValeur ?? null,
  });
  if (error) throw error;
}

/**
 * Journalise une tentative de connexion, réussie ou non.
 *
 * Trois raisons pour lesquelles cette fonction ne peut pas passer par
 * `auditLog` ci-dessus :
 *
 * 1. Sur un echec, il n'y a pas de session — `getTenantContext()` lèverait.
 * 2. Sur un succès, la session vient être créée dans la meme requete ; on
 *    prend identité directement depuis la réponse d'authentification plutot
 *    que de la relire.
 * 3. `auditLog` lève si l'écriture échoue, ce qui est le bon choix pour un
 *    paiement — mieux vaut annuler que perdre la trace. Ici ce serait absurde :
 *    un incident sur la table d'audit empêcherait tout le monde de se
 *    connecter. On avale donc l'erreur, en la signalant.
 *
 * L'écriture passe par le client service-role : un visiteur qui échoue à se
 * connecter n'a, par definition, aucun droit d'ecrire quoi que ce soit. C'est
 * le second usage légitime de ce client, avec le provisionnement des comptes.
 *
 * Les échecs sont journalisés autant que les succes : c'est leur répétition sur
 * un meme compte qui révèle une attaque par force brute, et cela ne se voit que
 * si on les enregistre.
 */
export async function journaliserConnexion(input: {
  email: string;
  reussie: boolean;
  userId?: string;
  motif?: string;
}): Promise<void> {
  try {
    const admin = createAdminClient();

    // Rattacher la tentative à un compte connu quand c'est possible : sans
    // cela, une série échecs ne serait imputable à personne.
    let userId = input.userId ?? null;
    let etablissementId: string | null = null;
    if (input.email) {
      const { data } = await admin
        .from('utilisateur')
        .select('id, "etablissementId"')
        .eq('email', input.email)
        .maybeSingle();
      if (data) {
        userId = userId ?? (data.id as string);
        etablissementId = (data.etablissementId as string | null) ?? null;
      }
    }

    await admin.from('audit_log').insert({
      etablissementId,
      userId,
      action: input.reussie ? 'CONNEXION' : 'CONNEXION_ECHOUEE',
      module: 'authentification',
      objetType: 'Utilisateur',
      objetId: userId,
      ancienneValeur: null,
      nouvelleValeur: { email: input.email, motif: input.motif ?? null },
    });
  } catch (erreur) {
    // Voir le point 3 ci-dessus : jamais bloquant.
    console.error("Échec de journalisation d'une tentative de connexion", erreur);
  }
}

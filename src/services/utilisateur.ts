import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Role } from './tenant';
import { getTenantContext } from './tenant';
import { requireRole } from './authorization';
import { auditLog } from './audit';
import { hashPin } from './pin';
import { urlApplication } from '@/lib/url-app';

export interface Utilisateur {
  id: string;
  etablissementId: string | null;
  nom: string;
  prenom: string;
  email: string;
  telephone: string | null;
  role: Role;
  statut: 'ACTIF' | 'INACTIF' | 'BLOQUE';
  dernierAcces: string | null;
  createdAt: string;
}

export interface InviteUtilisateurInput {
  email: string;
  nom: string;
  prenom: string;
  role: Role;
  etablissementId: string | null;
}

/**
 * Provisions a Supabase Auth user (invitation email), stamps the tenant claims
 * in app_metadata (picked up by the Auth Hook at token issue), and inserts the
 * matching `utilisateur` row. SUPER_ADMIN may invite a DIRECTEUR (or itself);
 * DIRECTEUR may invite SECRETAIRE/COMPTABLE/ENSEIGNANT for its own école.
 */
export async function inviteUtilisateur(input: InviteUtilisateurInput): Promise<Utilisateur> {
  if (input.role === 'DIRECTEUR' || input.role === 'SUPER_ADMIN') {
    await requireRole();
  } else {
    const ctx = await requireRole('DIRECTEUR');
    if (input.etablissementId !== ctx.etablissementId) {
      throw new Error('Accès refusé: établissement différent');
    }
  }

  const admin = createAdminClient();
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    input.email,
    {
      data: {},
      // L'invite n'a pas encore de mot de passe : le callback l'enverra sur
      // `/update-password`, deduit du `type=invite` du lien. Sans cela il
      // arriverait sur le tableau de bord avec une session valide mais aucun
      // moyen de se reconnecter le lendemain.
      redirectTo: `${urlApplication()}/auth/callback`,
    },
  );
  if (inviteError || !invited.user) {
    throw new Error(inviteError?.message ?? "Échec de l'invitation");
  }

  const { error: metaError } = await admin.auth.admin.updateUserById(invited.user.id, {
    app_metadata: {
      etablissement_id: input.etablissementId,
      role: input.role,
    },
  });
  if (metaError) throw metaError;

  const supabase = createClient();
  const { data, error } = await supabase
    .from('utilisateur')
    .insert({
      id: invited.user.id,
      etablissementId: input.etablissementId,
      nom: input.nom,
      prenom: input.prenom,
      email: input.email,
      role: input.role,
    })
    .select(
      'id, "etablissementId", nom, prenom, email, telephone, role, statut, "dernierAcces", "createdAt"',
    )
    .single();
  if (error) throw error;

  await auditLog({
    action: 'INVITE_UTILISATEUR',
    module: 'identity',
    objetType: 'Utilisateur',
    objetId: data.id,
    nouvelleValeur: { email: input.email, role: input.role, etablissementId: input.etablissementId },
  });

  return data;
}

export async function listUtilisateurs(): Promise<Utilisateur[]> {
  const ctx = await requireRole('DIRECTEUR');
  const supabase = createClient();
  const { data, error } = await supabase
    .from('utilisateur')
    .select(
      'id, "etablissementId", nom, prenom, email, telephone, role, statut, "dernierAcces", "createdAt"',
    )
    .eq('etablissementId', ctx.etablissementId)
    .neq('role', 'SUPER_ADMIN')
    .order('createdAt', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getUtilisateur(id: string): Promise<Utilisateur> {
  const ctx = await requireRole('DIRECTEUR');
  const supabase = createClient();
  const { data, error } = await supabase
    .from('utilisateur')
    .select(
      'id, "etablissementId", nom, prenom, email, telephone, role, statut, "dernierAcces", "createdAt"',
    )
    .eq('id', id)
    .eq('etablissementId', ctx.etablissementId)
    .single();
  if (error) throw error;
  return data;
}

export async function listUtilisateursParEtablissement(
  etablissementId: string,
): Promise<Utilisateur[]> {
  await requireRole();
  const supabase = createClient();
  const { data, error } = await supabase
    .from('utilisateur')
    .select(
      'id, "etablissementId", nom, prenom, email, telephone, role, statut, "dernierAcces", "createdAt"',
    )
    .eq('etablissementId', etablissementId)
    .order('createdAt', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/**
 * Banni cent ans. Supabase attend une duree, pas un booleen ; `'none'` la leve.
 *
 * Un bannissement interdit la connexion **et le renouvellement du jeton**.
 * C'est ce second effet qui compte : sans lui, une session ouverte se
 * prolongerait indefiniment.
 */
const BANNISSEMENT = '876000h';

/**
 * Retire l'acces d'un compte, pour de vrai.
 *
 * ## Ce que cette fonction ne faisait pas
 *
 * Elle ecrivait `statut = 'INACTIF'` et s'arretait la. Or **rien ne lit cette
 * colonne** : ni `requireRole`, qui travaille sur les seuls claims du JWT, ni
 * le middleware, qui ne regarde que l'abonnement. Aucun bannissement, aucune
 * revocation, les claims `app_metadata` intacts.
 *
 * Une secretaire renvoyee gardait donc un acces complet aux dossiers d'eleves
 * et aux factures, aussi longtemps que sa session se renouvelait. Constate le
 * 2026-09-11, et c'est le defaut de securite le plus probable du produit : un
 * depart de personnel est routinier, ouvrir les outils de developpeur ne l'est
 * pas.
 *
 * ## L'ordre des deux ecritures n'est pas indifferent
 *
 * Le bannissement **d'abord**, le statut ensuite. Les deux peuvent echouer, et
 * les deux echecs ne se valent pas : un compte banni encore affiche « Actif »
 * desoriente, un compte affiche « Inactif » qui conserve son acces est
 * exactement le defaut qu'on corrige. On garde donc le risque du premier.
 *
 * ## La fenetre qui reste
 *
 * Le bannissement interdit la connexion et le renouvellement, il ne detruit pas
 * le jeton d'acces deja emis : celui-ci reste valable jusqu'a son expiration,
 * une heure par defaut. L'API d'administration de Supabase n'expose pas de
 * revocation immediate des sessions d'un utilisateur. Cette heure est connue et
 * assumee, pas ignoree — et elle n'a aucun rapport avec l'acces illimite
 * d'avant.
 */
export async function desactiverUtilisateur(utilisateurId: string): Promise<void> {
  const ctx = await requireRole('DIRECTEUR');

  // Se desactiver soi-meme etait sans consequence tant que la desactivation
  // n'avait aucun effet. Maintenant qu'elle en a, un Directeur seul de son
  // ecole s'enfermerait dehors sans recours : personne d'autre n'a le droit de
  // le reactiver.
  if (utilisateurId === ctx.userId) {
    throw new Error('Vous ne pouvez pas désactiver votre propre compte.');
  }

  const supabase = createClient();

  // L'appartenance est verifiee **avant** le bannissement : la cle service-role
  // ne connait pas de tenant, et bannir sur un identifiant arbitraire
  // reviendrait a laisser une ecole couper l'acces d'une autre.
  const { data: cible, error: erreurCible } = await supabase
    .from('utilisateur')
    .select('id')
    .eq('id', utilisateurId)
    .eq('etablissementId', ctx.etablissementId)
    .maybeSingle();
  if (erreurCible) throw erreurCible;
  if (!cible) throw new Error('Utilisateur introuvable dans votre établissement.');

  const admin = createAdminClient();
  const { error: erreurBan } = await admin.auth.admin.updateUserById(utilisateurId, {
    ban_duration: BANNISSEMENT,
  });
  if (erreurBan) throw erreurBan;

  const { error } = await supabase
    .from('utilisateur')
    .update({ statut: 'INACTIF' })
    .eq('id', utilisateurId)
    .eq('etablissementId', ctx.etablissementId);
  if (error) throw error;

  await auditLog({
    action: 'DESACTIVER_UTILISATEUR',
    module: 'identity',
    objetType: 'Utilisateur',
    objetId: utilisateurId,
  });
}

/**
 * Rend l'acces a un compte desactive.
 *
 * Elle existe **parce que** la desactivation est devenue effective. Sans elle,
 * un clic de trop sur « Desactiver » serait une porte a sens unique : le
 * bannissement Auth ne se leve pas depuis le produit, et une ecole resterait
 * avec une secretaire definitivement dehors pour une erreur de ligne dans un
 * tableau.
 *
 * Ordre inverse de la desactivation, pour la meme raison : le statut d'abord,
 * le bannissement ensuite. Si le second echoue, le compte est affiche « Actif »
 * sans pouvoir entrer — genant et visible — plutot que l'inverse.
 */
export async function reactiverUtilisateur(utilisateurId: string): Promise<void> {
  const ctx = await requireRole('DIRECTEUR');
  const supabase = createClient();

  const { data: cible, error: erreurCible } = await supabase
    .from('utilisateur')
    .select('id')
    .eq('id', utilisateurId)
    .eq('etablissementId', ctx.etablissementId)
    .maybeSingle();
  if (erreurCible) throw erreurCible;
  if (!cible) throw new Error('Utilisateur introuvable dans votre établissement.');

  const { error } = await supabase
    .from('utilisateur')
    .update({ statut: 'ACTIF' })
    .eq('id', utilisateurId)
    .eq('etablissementId', ctx.etablissementId);
  if (error) throw error;

  const admin = createAdminClient();
  const { error: erreurBan } = await admin.auth.admin.updateUserById(utilisateurId, {
    ban_duration: 'none',
  });
  if (erreurBan) throw erreurBan;

  await auditLog({
    action: 'REACTIVER_UTILISATEUR',
    module: 'identity',
    objetType: 'Utilisateur',
    objetId: utilisateurId,
  });
}

export interface MonProfil {
  nom: string;
  prenom: string;
  email: string;
  role: Role;
  pinConfigure: boolean;
}

export async function getMonProfil(): Promise<MonProfil> {
  const ctx = await getTenantContext();
  const supabase = createClient();
  const { data, error } = await supabase
    .from('utilisateur')
    .select('nom, prenom, email, role, "pinApprobationHash"')
    .eq('id', ctx.userId)
    .single();
  if (error) throw error;

  return {
    nom: data.nom,
    prenom: data.prenom,
    email: data.email,
    role: data.role,
    pinConfigure: Boolean(data.pinApprobationHash),
  };
}

/**
 * Sets or replaces the current user's step-up PIN. Restricted to the roles that
 * actually need it (Secrétaire approves notes; Directeur overrides on TERMINEE
 * years) — see Doc 03.
 */
export async function definirPin(pin: string): Promise<void> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE');
  const hash = await hashPin(pin);

  const supabase = createClient();
  const { error } = await supabase
    .from('utilisateur')
    .update({ pinApprobationHash: hash })
    .eq('id', ctx.userId);
  if (error) throw error;

  await auditLog({
    action: 'DEFINIR_PIN',
    module: 'identity',
    objetType: 'Utilisateur',
    objetId: ctx.userId,
  });
}

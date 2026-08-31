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

export async function desactiverUtilisateur(utilisateurId: string): Promise<void> {
  const ctx = await requireRole('DIRECTEUR');
  const supabase = createClient();
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

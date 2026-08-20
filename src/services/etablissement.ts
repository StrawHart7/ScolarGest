import { createClient } from '@/lib/supabase/server';
import { requireRole } from './authorization';
import { auditLog } from './audit';

export interface Etablissement {
  id: string;
  nom: string;
  sigle: string | null;
  adresse: string | null;
  ville: string | null;
  telephone: string | null;
  email: string | null;
  statut: 'ACTIF' | 'INACTIF' | 'SUSPENDU';
  createdAt: string;
}

export interface CreateEtablissementInput {
  nom: string;
  sigle?: string;
  adresse?: string;
  ville?: string;
  telephone?: string;
  email?: string;
}

export async function listEtablissements(): Promise<Etablissement[]> {
  await requireRole();
  const supabase = createClient();
  const { data, error } = await supabase
    .from('etablissement')
    .select('id, nom, sigle, adresse, ville, telephone, email, statut, "createdAt"')
    .order('createdAt', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/**
 * Lecture d'un établissement. Le SUPER_ADMIN lit n'importe quel établissement
 * (console plateforme) ; les rôles école ne lisent que le leur — nécessaire
 * pour l'en-tête des documents officiels générés côté école (bulletins,
 * reçus), qui ont besoin du nom, de l'adresse et du contact de l'école.
 */
export async function getEtablissement(id: string): Promise<Etablissement> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE', 'ENSEIGNANT');
  if (ctx.role !== 'SUPER_ADMIN' && id !== ctx.etablissementId) {
    throw new Error('Accès refusé: établissement différent');
  }
  const supabase = createClient();
  const { data, error } = await supabase
    .from('etablissement')
    .select('id, nom, sigle, adresse, ville, telephone, email, statut, "createdAt"')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function createEtablissement(input: CreateEtablissementInput): Promise<Etablissement> {
  await requireRole();
  const supabase = createClient();
  const { data, error } = await supabase
    .from('etablissement')
    .insert({
      nom: input.nom,
      sigle: input.sigle || null,
      adresse: input.adresse || null,
      ville: input.ville || null,
      telephone: input.telephone || null,
      email: input.email || null,
    })
    .select('id, nom, sigle, adresse, ville, telephone, email, statut, "createdAt"')
    .single();
  if (error) throw error;

  // Créer un établissement, c'est ouvrir un tenant : l'action la plus lourde de
  // conséquence de toute la plateforme. Elle n'était pas tracée.
  await auditLog({
    action: 'CREATE_ETABLISSEMENT',
    module: 'etablissement',
    objetType: 'Etablissement',
    objetId: data.id,
    nouvelleValeur: { nom: data.nom, ville: data.ville },
  });

  return data;
}

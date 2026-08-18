import { createClient } from '@/lib/supabase/server';
import { requireRole } from './authorization';

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

export async function getEtablissement(id: string): Promise<Etablissement> {
  await requireRole();
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
  return data;
}

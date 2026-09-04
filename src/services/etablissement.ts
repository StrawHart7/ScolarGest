import { createClient } from '@/lib/supabase/server';
import { requireRole } from './authorization';
import { auditLog } from './audit';
import { CODE_PLAN_FONDATEUR, type RegimeTarifaire } from '@/lib/fondateur';

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
  regimeTarifaire: RegimeTarifaire;
  /** Fige a l'admission, garanti a vie. `null` hors programme fondateur. */
  tarifFondateurMensuel: number | null;
  fondatriceDepuisLe: string | null;
}

/**
 * Admet un etablissement au programme fondateur, ou l'en retire.
 *
 * Le tarif est **fige sur l'ecole** au moment de l'admission, copie depuis
 * `plan_abonnement`. Il n'est jamais relu ensuite : l'engagement commercial
 * est « tarif preferentiel garanti a vie », et le relire dans le catalogue le
 * rendrait revocable d'un UPDATE le jour ou le prix serait revu pour de
 * nouveaux entrants. Meme raisonnement que l'historisation des tarifs
 * scolaires.
 *
 * Les dix places ne sont **pas** verifiees ici. C'est le declencheur
 * `trg_limiter_ecoles_fondatrices` qui refuse la onzieme : une verification
 * applicative laisserait passer deux admissions simultanees, et la rarete est
 * tout l'argument du programme. La fonction se contente de traduire le refus
 * Postgres en phrase lisible — les erreurs Supabase ne sont pas des `Error`,
 * on lit donc `code` et `message` sur l'objet.
 */
export async function definirRegimeTarifaire(
  etablissementId: string,
  regime: RegimeTarifaire,
): Promise<void> {
  await requireRole();
  const supabase = createClient();

  let tarif: number | null = null;
  if (regime === 'FONDATRICE') {
    const { data: plan, error } = await supabase
      .from('plan_abonnement')
      .select('prix')
      .eq('code', CODE_PLAN_FONDATEUR)
      .maybeSingle();
    if (error) throw error;
    if (!plan) throw new Error("Le plan fondateur est introuvable dans le catalogue.");
    tarif = Number((plan as { prix: number }).prix);
  }

  const { error } = await supabase
    .from('etablissement')
    .update({
      regimeTarifaire: regime,
      tarifFondateurMensuel: tarif,
      // Le retrait efface la date d'entree : la garder laisserait croire
      // qu'une ecole sortie du programme y est encore.
      ...(regime === 'STANDARD' ? { fondatriceDepuisLe: null } : {}),
    })
    .eq('id', etablissementId);

  if (error) {
    const details = error as { code?: string; message?: string };
    if (details.code === '23514' || (details.message ?? '').includes('programme fondateur')) {
      throw new Error(
        details.message ?? 'Le programme fondateur est complet.',
      );
    }
    throw error;
  }

  await auditLog({
    action: regime === 'FONDATRICE' ? 'ADMETTRE_FONDATRICE' : 'RETIRER_FONDATRICE',
    module: 'plateforme',
    objetType: 'Etablissement',
    objetId: etablissementId,
    nouvelleValeur: { regime, tarifFondateurMensuel: tarif },
  });
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
    .select('id, nom, sigle, adresse, ville, telephone, email, statut, "createdAt", "regimeTarifaire", "tarifFondateurMensuel", "fondatriceDepuisLe"')
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
    .select('id, nom, sigle, adresse, ville, telephone, email, statut, "createdAt", "regimeTarifaire", "tarifFondateurMensuel", "fondatriceDepuisLe"')
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
    .select('id, nom, sigle, adresse, ville, telephone, email, statut, "createdAt", "regimeTarifaire", "tarifFondateurMensuel", "fondatriceDepuisLe"')
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

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from './authorization';
import { auditLog } from './audit';

/**
 * Identité visuelle des documents générés (bulletins, reçus) : logo de
 * l'établissement et filigrane.
 *
 * Le logo vit dans le bucket privé `documents` et n'est jamais exposé par une
 * URL publique : il est lu côté serveur puis intégré en data URI au moment du
 * rendu HTML → PDF. C'est ce qui permet de garder le bucket fermé, comme pour
 * les bulletins eux-mêmes.
 *
 * L'existence de la ligne vaut « déjà proposé une fois » : la question est
 * posée à la première génération de document, jamais reposée ensuite, mais le
 * réglage reste modifiable depuis les paramètres — un réglage qu'on ne peut
 * plus corriger est un piège, pas une simplification.
 */

const BUCKET = 'documents';

/** Formats acceptés pour le logo, et taille maximale (data URI dans le PDF). */
const TYPES_LOGO = ['image/png', 'image/jpeg', 'image/webp'] as const;
const TAILLE_MAX_LOGO = 1024 * 1024;

export interface ParametresDocument {
  filigraneTexte: string | null;
  filigraneActif: boolean;
  logoChemin: string | null;
  /** La question a déjà été posée : ne plus la proposer à la génération. */
  dejaConfigure: boolean;
}

const PARAMETRES_PAR_DEFAUT: ParametresDocument = {
  filigraneTexte: null,
  filigraneActif: false,
  logoChemin: null,
  dejaConfigure: false,
};

/**
 * Lecture ouverte à tous les rôles qui génèrent des documents : le Directeur
 * et la Secrétaire pour les bulletins, la Secrétaire et le Comptable pour les
 * reçus. Sans cela, un Comptable ne pourrait pas éditer un reçu.
 */
export async function getParametresDocument(): Promise<ParametresDocument> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE');
  const supabase = createClient();
  const { data, error } = await supabase
    .from('parametres_document')
    .select('"filigraneTexte", "filigraneActif", "logoChemin"')
    .eq('etablissementId', ctx.etablissementId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return PARAMETRES_PAR_DEFAUT;

  const ligne = data as Omit<ParametresDocument, 'dejaConfigure'>;
  return { ...ligne, dejaConfigure: true };
}

export interface EnregistrerParametresInput {
  filigraneTexte: string | null;
  filigraneActif: boolean;
}

/** Le filigrane relève de la direction : il engage l'apparence officielle. */
export async function enregistrerParametresDocument(
  input: EnregistrerParametresInput,
): Promise<void> {
  const ctx = await requireRole('DIRECTEUR');
  const supabase = createClient();

  const texte = input.filigraneTexte?.trim() || null;
  const { error } = await supabase.from('parametres_document').upsert(
    {
      etablissementId: ctx.etablissementId,
      filigraneTexte: texte,
      // Un filigrane actif sans texte n'afficherait rien : on refuse
      // l'incohérence plutôt que de laisser un réglage sans effet visible.
      filigraneActif: input.filigraneActif && texte !== null,
    },
    { onConflict: 'etablissementId' },
  );
  if (error) throw error;

  await auditLog({
    action: 'MODIFIER_PARAMETRES_DOCUMENT',
    module: 'documents',
    objetType: 'ParametresDocument',
    objetId: ctx.etablissementId ?? undefined,
    nouvelleValeur: { filigraneTexte: texte, filigraneActif: input.filigraneActif },
  });
}

/**
 * Remplace le logo. Le chemin est fixe par établissement (`upsert`) : garder
 * un historique de logos n'a pas d'intérêt et laisserait grossir le bucket.
 */
export async function televerserLogo(fichier: File): Promise<string> {
  const ctx = await requireRole('DIRECTEUR');

  if (!TYPES_LOGO.includes(fichier.type as (typeof TYPES_LOGO)[number])) {
    throw new Error('Format accepté : PNG, JPEG ou WebP.');
  }
  if (fichier.size > TAILLE_MAX_LOGO) {
    throw new Error('Le logo ne doit pas dépasser 1 Mo.');
  }

  const extension = fichier.type === 'image/png' ? 'png' : fichier.type === 'image/webp' ? 'webp' : 'jpg';
  const chemin = `${ctx.etablissementId}/identite/logo.${extension}`;
  const admin = createAdminClient();
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(chemin, Buffer.from(await fichier.arrayBuffer()), {
      contentType: fichier.type,
      upsert: true,
    });
  if (error) throw new Error(`Échec de l'envoi du logo : ${error.message}`);

  const supabase = createClient();
  const { error: erreurMaj } = await supabase
    .from('parametres_document')
    .upsert(
      { etablissementId: ctx.etablissementId, logoChemin: chemin },
      { onConflict: 'etablissementId' },
    );
  if (erreurMaj) throw erreurMaj;

  await auditLog({
    action: 'MODIFIER_LOGO',
    module: 'documents',
    objetType: 'ParametresDocument',
    objetId: ctx.etablissementId ?? undefined,
    nouvelleValeur: { logoChemin: chemin },
  });

  return chemin;
}

export async function supprimerLogo(): Promise<void> {
  const ctx = await requireRole('DIRECTEUR');
  const supabase = createClient();
  const { data } = await supabase
    .from('parametres_document')
    .select('"logoChemin"')
    .eq('etablissementId', ctx.etablissementId)
    .maybeSingle();

  const chemin = (data as { logoChemin: string | null } | null)?.logoChemin;
  if (chemin) {
    await createAdminClient().storage.from(BUCKET).remove([chemin]);
  }

  const { error } = await supabase
    .from('parametres_document')
    .update({ logoChemin: null })
    .eq('etablissementId', ctx.etablissementId);
  if (error) throw error;

  await auditLog({
    action: 'SUPPRIMER_LOGO',
    module: 'documents',
    objetType: 'ParametresDocument',
    objetId: ctx.etablissementId ?? undefined,
  });
}

/**
 * Logo en data URI, prêt à être intégré dans le HTML du document.
 *
 * Gardée et scopée bien qu'appelée depuis des services déjà gardés : elle
 * reçoit un **chemin arbitraire** et lit dans le bucket avec la clé
 * service-role, qui contourne la RLS. Sans la vérification du préfixe
 * ci-dessous, un chemin forgé permettrait de lire le fichier d'un autre
 * établissement — défense en profondeur, comme partout ailleurs dans le repo.
 *
 * Renvoie `null` plutôt que de lever si le fichier est absent ou illisible :
 * un logo manquant ne doit jamais empêcher l'édition d'un bulletin ou d'un
 * reçu — le document sort simplement sans logo.
 */
export async function chargerLogoDataUri(chemin: string | null): Promise<string | null> {
  if (!chemin) return null;
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE');
  if (!ctx.etablissementId || !chemin.startsWith(`${ctx.etablissementId}/`)) return null;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.storage.from(BUCKET).download(chemin);
    if (error || !data) return null;
    const octets = Buffer.from(await data.arrayBuffer());
    const type = chemin.endsWith('.png')
      ? 'image/png'
      : chemin.endsWith('.webp')
        ? 'image/webp'
        : 'image/jpeg';
    return `data:${type};base64,${octets.toString('base64')}`;
  } catch {
    return null;
  }
}

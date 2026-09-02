import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from './authorization';
import { auditLog } from './audit';
import { TAILLE_MAX_PIECE_JOINTE, TYPES_PIECE_JOINTE } from '@/lib/support';
import type {
  DemandeSupport,
  DemandeSupportPlateforme,
  NouvelleDemandeSupport,
  PieceJointeSupport,
  StatutSupport,
} from '@/lib/support';

// Le vocabulaire (catégories, statuts, libellés, formes) vit dans
// `src/lib/support.ts`, qui ne dépend de rien : les composants clients en ont
// besoin, et l'importer depuis ce fichier-ci ferait remonter `next/headers`
// dans un bundle client — ce qui casse le build sans que `tsc` ni ESLint ne le
// voient. Réexporté ici pour que les appelants serveur n'aient qu'un import.
export type {
  CategorieSupport,
  StatutSupport,
  DemandeSupport,
  DemandeSupportPlateforme,
  NouvelleDemandeSupport,
  PieceJointeSupport,
} from '@/lib/support';

/**
 * Contact support : le canal par lequel une école joint la plateforme.
 *
 * `/profil/aide` répondait à une FAQ figée et s'arrêtait là. Une école bloquée
 * sur autre chose n'avait aucun recours depuis le produit.
 *
 * Deux choix structurants, voir aussi la migration `0023` :
 *
 * - **La demande est portée par l'établissement, pas par l'auteur.** Le
 *   Directeur doit pouvoir relire ce que sa Secrétaire a envoyé : un ticket
 *   invisible à l'école se rouvre en double la semaine suivante.
 * - **L'identité de l'auteur est figée à l'envoi** (nom, email, rôle). Un
 *   compte change de rôle ou est désactivé ; la demande doit continuer de dire
 *   qui l'a écrite et à quel titre. Même raisonnement que l'historisation des
 *   tarifs.
 *
 * La page vit sous `/profil/support` **délibérément** : `/profil` figure dans
 * `PATHS_TOUJOURS_ACCESSIBLES` (`src/lib/supabase/middleware.ts`), donc une
 * école passée en lecture seule peut encore écrire au support — c'est
 * précisément celle qui en a le plus besoin. Déplacer cette page ailleurs
 * refermerait le canal au pire moment, sans erreur visible nulle part.
 */

const CHAMPS =
  'id, "etablissementId", "auteurNom", "auteurEmail", "auteurRole", categorie, sujet, message, "pageOrigine", statut, "reponseSupport", "repondueLe", "fichierChemin", "fichierNom", "createdAt"';

const BUCKET_SUPPORT = 'support';

/**
 * Dépose une demande pour l'établissement de l'appelant.
 *
 * Les quatre rôles école y ont accès : le blocage arrive le plus souvent chez
 * celui qui saisit — un enseignant devant une note refusée, une comptable
 * devant une facture figée — et non chez le Directeur. Le faire transiter par
 * la direction retarde et déforme.
 *
 * L'`etablissementId` n'est jamais accepté de l'appelant : il est pris sur le
 * contexte. La policy RLS le revalide, mais s'appuyer sur la seule RLS ne
 * suffit pas (voir CLAUDE.md).
 */
export async function creerDemandeSupport(
  input: NouvelleDemandeSupport,
  piece?: PieceJointeSupport | null,
): Promise<{ id: string }> {
  // Les rôles sont écrits en toutes lettres, jamais via un tableau partagé
  // qu'on déplierait ici : le générateur de `Docs/11-Matrice-permissions.md`
  // lit ces appels textuellement, et une garde qu'il ne sait pas déplier
  // ressort en « DYNAMIQUE » — c'est-à-dire invérifiable.
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE', 'ENSEIGNANT');
  if (!ctx.etablissementId) {
    throw new Error('Aucun établissement rattaché à ce compte.');
  }
  const supabase = createClient();

  // Le nom lisible n'est pas dans le jeton : on le lit une fois, à l'envoi, et
  // on le fige. Un support qui ne lit qu'une adresse email perd du temps à
  // chaque échange.
  const { data: auteur } = await supabase
    .from('utilisateur')
    .select('nom, prenom')
    .eq('id', ctx.userId)
    .maybeSingle();
  const identite = auteur as { nom: string; prenom: string } | null;
  const nomComplet = identite ? `${identite.prenom} ${identite.nom}`.trim() : ctx.email;

  // Le fichier est deverse AVANT la ligne : si le depot echoue, aucune demande
  // n'est creee, et l'ecole reessaie. L'ordre inverse laisserait une demande
  // annoncant une piece jointe absente, que le support reclamerait en vain.
  const chemin = piece ? await deposerPieceJointe(ctx.etablissementId, piece) : null;

  const { data, error } = await supabase
    .from('support_demande')
    .insert({
      etablissementId: ctx.etablissementId,
      auteurId: ctx.userId,
      auteurNom: nomComplet,
      auteurEmail: ctx.email,
      auteurRole: ctx.role,
      categorie: input.categorie,
      sujet: input.sujet,
      message: input.message,
      pageOrigine: input.pageOrigine ?? null,
      fichierChemin: chemin,
      fichierNom: piece ? piece.nom : null,
    })
    .select('id')
    .single();
  if (error) throw error;

  await auditLog({
    action: 'CREER_DEMANDE_SUPPORT',
    module: 'support',
    objetType: 'DemandeSupport',
    objetId: (data as { id: string }).id,
    nouvelleValeur: { categorie: input.categorie, sujet: input.sujet },
  });

  return { id: (data as { id: string }).id };
}

/**
 * Les demandes de l'établissement de l'appelant, les plus récentes d'abord.
 *
 * Toutes celles de l'école, pas seulement celles de l'appelant : c'est ce qui
 * évite qu'une même question soit posée trois fois par trois collègues.
 */
export async function listDemandesSupportEtablissement(): Promise<DemandeSupport[]> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE', 'ENSEIGNANT');
  const supabase = createClient();
  const { data, error } = await supabase
    .from('support_demande')
    .select(CHAMPS)
    .eq('etablissementId', ctx.etablissementId)
    .order('createdAt', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as DemandeSupport[];
}

/**
 * Toutes les demandes, toutes écoles confondues. SUPER_ADMIN seul.
 *
 * Pas de pagination, comme `listDemandesDemo` : le volume attendu se compte en
 * dizaines. À revoir si la file grossit.
 */
export async function listDemandesSupport(): Promise<DemandeSupportPlateforme[]> {
  await requireRole();
  const supabase = createClient();
  const { data, error } = await supabase
    .from('support_demande')
    .select(`${CHAMPS}, etablissement:etablissement!inner(nom)`)
    .order('createdAt', { ascending: false });
  if (error) throw error;
  type Ligne = DemandeSupport & {
    etablissement: { nom: string } | { nom: string }[] | null;
  };
  return ((data ?? []) as unknown as Ligne[]).map(({ etablissement, ...demande }) => ({
    ...demande,
    etablissementNom: Array.isArray(etablissement)
      ? (etablissement[0]?.nom ?? 'Établissement inconnu')
      : (etablissement?.nom ?? 'Établissement inconnu'),
  }));
}

/**
 * Répond à une demande et la fait avancer.
 *
 * Réponse et statut sont écrits ensemble : une réponse laissée en « nouvelle »
 * serait retraitée par le collègue suivant, et un statut avancé sans réponse
 * laisse l'école devant un ticket clos qu'elle ne comprend pas.
 */
export async function repondreDemandeSupport(
  id: string,
  reponse: string,
  statut: StatutSupport,
): Promise<void> {
  await requireRole();
  const supabase = createClient();

  const { data: avant, error: erreurLecture } = await supabase
    .from('support_demande')
    .select('statut, sujet')
    .eq('id', id)
    .maybeSingle();
  if (erreurLecture) throw erreurLecture;
  if (!avant) throw new Error('Demande introuvable.');

  const { error } = await supabase
    .from('support_demande')
    .update({ reponseSupport: reponse, repondueLe: new Date().toISOString(), statut })
    .eq('id', id);
  if (error) throw error;

  await auditLog({
    action: 'REPONDRE_DEMANDE_SUPPORT',
    module: 'support',
    objetType: 'DemandeSupport',
    objetId: id,
    ancienneValeur: { statut: (avant as { statut: string }).statut },
    nouvelleValeur: { statut, sujet: (avant as { sujet: string }).sujet },
  });
}

/** Fait avancer une demande sans y répondre (prise en charge, fermeture). */
export async function changerStatutDemandeSupport(
  id: string,
  statut: StatutSupport,
): Promise<void> {
  await requireRole();
  const supabase = createClient();

  const { data: avant, error: erreurLecture } = await supabase
    .from('support_demande')
    .select('statut, sujet')
    .eq('id', id)
    .maybeSingle();
  if (erreurLecture) throw erreurLecture;
  if (!avant) throw new Error('Demande introuvable.');

  const { error } = await supabase.from('support_demande').update({ statut }).eq('id', id);
  if (error) throw error;

  await auditLog({
    action: 'CHANGER_STATUT_DEMANDE_SUPPORT',
    module: 'support',
    objetType: 'DemandeSupport',
    objetId: id,
    ancienneValeur: { statut: (avant as { statut: string }).statut },
    nouvelleValeur: { statut, sujet: (avant as { sujet: string }).sujet },
  });
}

/**
 * Depose une piece jointe et renvoie son chemin.
 *
 * Ecriture par la cle service-role, apres la garde de role de l'appelant. Le
 * bucket est prive et le tenant n'y a que la lecture : lui donner l'ecriture
 * directe le laisserait **choisir son prefixe**, donc ecrire sous le dossier
 * d'une autre ecole. Le chemin est construit ici, jamais recu.
 *
 * Le nom de stockage est randomise et l'extension deduite du nom d'origine :
 * reprendre le nom envoye ferait entrer dans un chemin de stockage une chaine
 * choisie par l'appelant.
 */
async function deposerPieceJointe(
  etablissementId: string,
  piece: PieceJointeSupport,
): Promise<string> {
  if (piece.contenu.byteLength > TAILLE_MAX_PIECE_JOINTE) {
    throw new Error('Fichier trop volumineux (10 Mo maximum).');
  }
  if (!(TYPES_PIECE_JOINTE as readonly string[]).includes(piece.type)) {
    throw new Error('Type de fichier non accepte (classeur, PDF ou image).');
  }

  const extension = (piece.nom.split('.').pop() ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const suffixe = extension ? `.${extension}` : '';
  const chemin = `${etablissementId}/support/${crypto.randomUUID()}${suffixe}`;

  const admin = createAdminClient();
  const { error } = await admin.storage
    .from(BUCKET_SUPPORT)
    .upload(chemin, Buffer.from(piece.contenu), { contentType: piece.type, upsert: false });
  if (error) throw error;

  return chemin;
}

/**
 * Lien de telechargement temporaire pour la piece jointe d'une demande.
 *
 * Le bucket etant prive, le navigateur n'a aucune session pour aller y chercher
 * un fichier : il faut une URL signee, emise cote serveur.
 *
 * Ouvert au SUPER_ADMIN et aux roles ecole, mais le chemin n'est jamais recu de
 * l'appelant — il est relu depuis la demande, dont la lecture est deja filtree
 * par la RLS. Accepter un chemin en parametre transformerait cette fonction en
 * lecteur universel du bucket.
 */
export async function getLienPieceJointe(demandeId: string): Promise<string | null> {
  await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE', 'ENSEIGNANT');
  const supabase = createClient();

  const { data, error } = await supabase
    .from('support_demande')
    .select('"fichierChemin"')
    .eq('id', demandeId)
    .maybeSingle();
  if (error) throw error;
  const chemin = (data as { fichierChemin: string | null } | null)?.fichierChemin;
  if (!chemin) return null;

  const admin = createAdminClient();
  const { data: signe, error: erreurSignature } = await admin.storage
    .from(BUCKET_SUPPORT)
    .createSignedUrl(chemin, 300);
  if (erreurSignature) throw erreurSignature;
  return signe?.signedUrl ?? null;
}

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { journaliserConnexion } from '@/services/audit';
import { urlApplication } from '@/lib/url-app';

/**
 * Point d'arrivée de toutes les authentifications par lien : OAuth Google,
 * invitation d'un utilisateur, réinitialisation de mot de passe.
 *
 * **Deux mécanismes, pas un seul.** C'est la cause des pannes constatées le
 * 2026-08-31 sur les invitations et les réinitialisations.
 *
 * - `?code=` — flux PKCE. `exchangeCodeForSession` exige un `code_verifier`
 *   déposé en cookie **dans le navigateur qui a démarré le flux**. Cela
 *   convient à Google : le même navigateur part et revient. Cela ne peut pas
 *   marcher pour un email d'invitation, où le flux démarre dans le navigateur
 *   du SUPER_ADMIN et se termine dans celui de l'invité — le vérificateur
 *   n'existe nulle part chez le destinataire, l'échange échoue, et
 *   l'utilisateur atterrit sur `/login` sans comprendre pourquoi.
 * - `?token_hash=&type=` — vérification directe par `verifyOtp`, **sans
 *   vérificateur**. C'est le seul mécanisme qui fonctionne pour un lien reçu
 *   par email, quel que soit l'appareil ou le navigateur qui l'ouvre.
 *
 * Les deux sont acceptés : `code` pour Google, `token_hash` pour les emails.
 *
 * Le second suppose que les gabarits d'email Supabase envoient `token_hash`
 * plutôt que le `{{ .ConfirmationURL }}` par défaut. Voir `CLAUDE.md`,
 * section « Authentification par lien ».
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // `urlApplication()` plutôt que l'`origin` de la requête : celui-ci vaut
  // l'hôte réellement appelé, qui peut être une adresse de déploiement Vercel
  // au lieu du domaine public. Le repli sur `VERCEL_URL` garde chaque preview
  // sur elle-même.
  const base = urlApplication();

  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');

  // Une invitation et une réinitialisation aboutissent au même endroit : un
  // écran où choisir son mot de passe. Un invité n'en a pas encore, l'envoyer
  // au tableau de bord le laisserait sans moyen de se reconnecter demain.
  const destinationParDefaut =
    type === 'recovery' || type === 'invite' ? '/update-password' : '/dashboard';
  const next = searchParams.get('next') ?? destinationParDefaut;

  const supabase = createClient();

  if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as 'invite' | 'recovery' | 'email' | 'magiclink' | 'signup' | 'email_change',
    });
    if (!error) {
      await journaliserConnexion({
        email: data.user?.email ?? '',
        reussie: true,
        userId: data.user?.id,
      });
      return NextResponse.redirect(`${base}${next}`);
    }
    return NextResponse.redirect(`${base}/login?error=lien_invalide`);
  }

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Une connexion Google est une connexion : sans cette ligne, la trace
      // exigée par le doc 03 § 12 aurait un angle mort exactement de la taille
      // du fournisseur d'identité le plus utilisé.
      await journaliserConnexion({
        email: data.user?.email ?? '',
        reussie: true,
        userId: data.user?.id,
      });
      return NextResponse.redirect(`${base}${next}`);
    }
    // Distinguer ce cas du précédent : ici le lien était bon, mais le
    // navigateur qui l'ouvre n'est pas celui qui a démarré le flux.
    return NextResponse.redirect(`${base}/login?error=session_introuvable`);
  }

  return NextResponse.redirect(`${base}/login?error=lien_incomplet`);
}

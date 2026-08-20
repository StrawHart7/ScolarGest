import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { journaliserConnexion } from '@/services/audit';

// Exchanges the OAuth/PKCE code for a session after the provider redirect (Google, etc.).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = createClient();
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
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}

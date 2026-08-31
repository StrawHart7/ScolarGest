'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { journaliserConnexion } from '@/services/audit';
import { urlApplication } from '@/lib/url-app';

export async function login(_prevState: string | null, formData: FormData): Promise<string> {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');

  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Journalise avant de rendre la main : le doc 03 § 12 exige la trace des
    // connexions, et un échec compte autant qu'un succès — c'est la répétition
    // des échecs sur un même compte qui révèle une attaque.
    await journaliserConnexion({ email, reussie: false, motif: error.message });
    return error.message;
  }

  await journaliserConnexion({ email, reussie: true, userId: data.user?.id });

  redirect('/dashboard');
}

export async function loginWithGoogle(): Promise<void> {
  // `urlApplication()` et non l'en-tete `origin` : celui-ci vaut l'hote
  // reellement appele, qui peut etre une adresse de deploiement Vercel plutot
  // que le domaine public. Si l'URL construite ne figure pas dans les Redirect
  // URLs de Supabase, Supabase l'ignore et renvoie sur son « Site URL » —
  // l'utilisateur revient alors sur la page d'accueil, connecte mais perdu,
  // sans le moindre message d'erreur.
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${urlApplication()}/auth/callback` },
  });

  if (error || !data.url) {
    redirect('/login?error=google_auth_failed');
  }

  redirect(data.url);
}

'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { journaliserConnexion } from '@/services/audit';

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
  const origin = headers().get('origin');
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${origin}/auth/callback` },
  });

  if (error || !data.url) {
    redirect('/login?error=google_auth_failed');
  }

  redirect(data.url);
}

'use server';

import { createClient } from '@/lib/supabase/server';
import { urlApplication } from '@/lib/url-app';

export async function requestPasswordReset(
  _prevState: string | null,
  formData: FormData,
): Promise<string> {
  const email = String(formData.get('email') ?? '');

  const supabase = createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${urlApplication()}/auth/callback`,
  });

  // Toujours le même message, que l'email existe ou non (pas d'énumération de comptes).
  return 'Si un compte existe pour cette adresse, un email de réinitialisation a été envoyé.';
}

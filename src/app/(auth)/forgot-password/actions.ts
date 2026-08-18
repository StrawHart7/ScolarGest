'use server';

import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export async function requestPasswordReset(
  _prevState: string | null,
  formData: FormData,
): Promise<string> {
  const email = String(formData.get('email') ?? '');
  const origin = headers().get('origin');

  const supabase = createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/update-password`,
  });

  // Toujours le même message, que l'email existe ou non (pas d'énumération de comptes).
  return 'Si un compte existe pour cette adresse, un email de réinitialisation a été envoyé.';
}

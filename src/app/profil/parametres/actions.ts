'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * Aucune route de déconnexion n'existait : la seule façon de fermer une
 * session était de vider les cookies du navigateur.
 */
export async function seDeconnecterAction(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

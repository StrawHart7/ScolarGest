'use server';

import { createClient } from '@/lib/supabase/server';

export interface DemandeDemoState {
  status: 'idle' | 'success' | 'error';
  message: string;
}

export async function submitDemandeDemo(
  _prevState: DemandeDemoState,
  formData: FormData,
): Promise<DemandeDemoState> {
  const nomEtablissement = String(formData.get('nomEtablissement') ?? '').trim();
  const nomContact = String(formData.get('nomContact') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const telephone = String(formData.get('telephone') ?? '').trim();
  const ville = String(formData.get('ville') ?? '').trim();
  const message = String(formData.get('message') ?? '').trim();

  if (!nomEtablissement || !nomContact || !email) {
    return { status: 'error', message: 'Merci de remplir les champs obligatoires.' };
  }

  const supabase = createClient();
  const { error } = await supabase.from('demande_demo').insert({
    nomEtablissement,
    nomContact,
    email,
    telephone: telephone || null,
    ville: ville || null,
    message: message || null,
  });

  if (error) {
    // eslint-disable-next-line no-console
    console.error('submitDemandeDemo insert failed:', error);
    return { status: 'error', message: "Une erreur est survenue. Réessayez ou écrivez-nous directement." };
  }

  return {
    status: 'success',
    message: 'Merci ! Votre demande a bien été enregistrée, notre équipe vous recontacte sous peu.',
  };
}

'use server';

import { createClient } from '@/lib/supabase/server';
import { normaliserOrigine } from '@/lib/origine-demande';

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
  // Le champ arrive d'un `<input type="hidden">` rempli par le navigateur : il
  // est donc normalisé, jamais écrit tel quel. Une valeur inventée retombe sur
  // `DIRECT` plutôt que de faire échouer l'envoi — perdre un prospect coûte
  // infiniment plus cher que perdre son attribution.
  const origine = normaliserOrigine(formData.get('origine'));

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
    origine,
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

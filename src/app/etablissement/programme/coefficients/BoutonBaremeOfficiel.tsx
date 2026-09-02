'use client';

import { useFormState } from 'react-dom';
import { Landmark } from 'lucide-react';
import { SubmitButton } from '@/components/ui/button';
import { appliquerBaremeOfficielAction } from './actions';

/**
 * Aligne les coefficients sur le barème du ministère.
 *
 * Bouton distinct de « Enregistrer les coefficients », parce que les deux ne
 * font pas la même chose : le formulaire soumet ce qui est affiché — donc les
 * valeurs déjà en base — tandis que celui-ci va chercher les valeurs
 * nationales. Les confondre produirait un bouton qui promet d'aligner et
 * réécrit à l'identique.
 *
 * Le message de retour est affiché tel quel : il porte le nombre de
 * coefficients réellement écrits, seule façon de savoir si l'action a fait
 * quelque chose.
 */
export function BoutonBaremeOfficiel({ anneeScolaireId }: { anneeScolaireId: string }) {
  const [message, action] = useFormState(appliquerBaremeOfficielAction, null);

  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="anneeScolaireId" value={anneeScolaireId} />
      <SubmitButton variant="secondary" size="sm" libelleEnCours="Application…">
        <Landmark className="h-4 w-4" aria-hidden />
        Appliquer le barème national
      </SubmitButton>
      {message && <span className="text-body-sm text-text-secondary">{message}</span>}
    </form>
  );
}

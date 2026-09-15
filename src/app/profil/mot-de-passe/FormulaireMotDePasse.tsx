'use client';

import { useFormState } from 'react-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SubmitButton } from '@/components/ui/button';
import { changerMotDePasseAction } from './actions';

/**
 * Changer son mot de passe depuis l'application.
 *
 * L'ancien mot de passe est demandé, et il est réellement vérifié côté serveur
 * par une connexion : `auth.updateUser` ne l'exige pas, or une session laissée
 * ouverte sur un poste partagé — l'ordinaire d'une salle des professeurs —
 * suffirait sinon à prendre le compte.
 */
export function FormulaireMotDePasse({ impose }: { impose: boolean }) {
  const [erreur, formAction] = useFormState(changerMotDePasseAction, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ancien">
          {impose ? 'Mot de passe provisoire (celui qu’on vous a remis)' : 'Mot de passe actuel'}
        </Label>
        <Input
          id="ancien"
          name="ancien"
          type="password"
          autoComplete="current-password"
          required
          autoFocus
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="nouveau">Nouveau mot de passe</Label>
        <Input
          id="nouveau"
          name="nouveau"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
        <p className="text-body-sm text-text-secondary">
          Au moins 8 caractères. Choisissez-en un dont vous vous souviendrez.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirmation">Retapez le nouveau mot de passe</Label>
        <Input
          id="confirmation"
          name="confirmation"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>

      {erreur && <p className="text-body-sm text-error">{erreur}</p>}

      <SubmitButton libelleEnCours="Enregistrement…">Enregistrer le nouveau mot de passe</SubmitButton>
    </form>
  );
}

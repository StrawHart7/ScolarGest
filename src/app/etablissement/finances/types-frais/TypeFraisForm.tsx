'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { creerTypeFraisAction } from './actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Création...' : 'Ajouter le type de frais'}
    </Button>
  );
}

export function TypeFraisForm() {
  const [error, formAction] = useFormState(creerTypeFraisAction, null);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="nom">Libellé</Label>
        <Input id="nom" name="nom" placeholder="Scolarité 1er trimestre" required className="w-64" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Description</Label>
        <Input id="description" name="description" placeholder="Optionnel" className="w-72" />
      </div>
      <SubmitButton />
      {error && <p className="w-full text-body-sm text-error">{error}</p>}
    </form>
  );
}

'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { creerMatiereAction } from './actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Création...' : 'Ajouter la matière'}
    </Button>
  );
}

export function MatiereForm() {
  const [error, formAction] = useFormState(creerMatiereAction, null);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="nom">Nom</Label>
        <Input id="nom" name="nom" placeholder="Mathématiques" required className="w-56" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="code">Code</Label>
        <Input id="code" name="code" placeholder="MATH" className="w-32" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Description</Label>
        <Input id="description" name="description" placeholder="Optionnel" className="w-64" />
      </div>
      <SubmitButton />
      {error && <p className="w-full text-body-sm text-error">{error}</p>}
    </form>
  );
}

'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { inviterDirecteurAction } from './actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? 'Invitation...' : "Envoyer l'invitation"}
    </Button>
  );
}

/** Ajoute un Directeur supplémentaire à l'établissement — direction partagée
 * ou transition, un établissement peut en avoir plusieurs. */
export function InviterDirecteurForm({ etablissementId }: { etablissementId: string }) {
  const [ouvert, setOuvert] = useState(false);
  const [error, formAction] = useFormState(inviterDirecteurAction, null);

  if (!ouvert) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOuvert(true)}>
        Ajouter un directeur
      </Button>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-lg border border-surface-border bg-surface-container-low/50 p-4"
    >
      <input type="hidden" name="etablissementId" value={etablissementId} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="prenom">Prénom</Label>
          <Input id="prenom" name="prenom" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nom">Nom</Label>
          <Input id="nom" name="nom" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required />
        </div>
      </div>
      {error && <p className="text-body-sm text-error">{error}</p>}
      <div className="flex items-center gap-2">
        <SubmitButton />
        <Button type="button" variant="ghost" size="sm" onClick={() => setOuvert(false)}>
          Annuler
        </Button>
      </div>
    </form>
  );
}

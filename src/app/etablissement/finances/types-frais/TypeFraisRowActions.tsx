'use client';

import { useState, useTransition } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { TypeFrais } from '@/services/type-frais';
import { modifierTypeFraisAction } from './actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? 'Enregistrement...' : 'Enregistrer'}
    </Button>
  );
}

export function TypeFraisRowActions({ typeFrais }: { typeFrais: TypeFrais }) {
  const [editing, setEditing] = useState(false);
  const [error, formAction] = useFormState(modifierTypeFraisAction, null);
  const [pendingToggle, startTransition] = useTransition();

  if (editing) {
    return (
      <form action={formAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="id" value={typeFrais.id} />
        <Input name="nom" defaultValue={typeFrais.nom} className="h-8 w-48" />
        <Input
          name="description"
          defaultValue={typeFrais.description ?? ''}
          className="h-8 w-56"
        />
        <SubmitButton />
        <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
          Annuler
        </Button>
        {error && <p className="w-full text-body-sm text-error">{error}</p>}
      </form>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
        Modifier
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={pendingToggle}
        onClick={() => {
          const formData = new FormData();
          formData.set('id', typeFrais.id);
          formData.set('statut', typeFrais.statut === 'ACTIF' ? 'INACTIF' : 'ACTIF');
          startTransition(() => {
            void modifierTypeFraisAction(null, formData);
          });
        }}
      >
        {typeFrais.statut === 'ACTIF' ? 'Désactiver' : 'Activer'}
      </Button>
    </div>
  );
}

'use client';

import { useState, useTransition } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { Matiere } from '@/services/matiere';
import { modifierMatiereAction } from './actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? 'Enregistrement...' : 'Enregistrer'}
    </Button>
  );
}

export function MatiereRowActions({ matiere }: { matiere: Matiere }) {
  const [editing, setEditing] = useState(false);
  const [error, formAction] = useFormState(modifierMatiereAction, null);
  const [pendingToggle, startTransition] = useTransition();

  if (editing) {
    return (
      <form action={formAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="id" value={matiere.id} />
        <Input name="nom" defaultValue={matiere.nom} className="h-8 w-40" />
        <Input name="code" defaultValue={matiere.code ?? ''} className="h-8 w-24" />
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
          formData.set('id', matiere.id);
          formData.set('statut', matiere.statut === 'ACTIF' ? 'INACTIF' : 'ACTIF');
          startTransition(() => {
            void modifierMatiereAction(null, formData);
          });
        }}
      >
        {matiere.statut === 'ACTIF' ? 'Désactiver' : 'Activer'}
      </Button>
    </div>
  );
}

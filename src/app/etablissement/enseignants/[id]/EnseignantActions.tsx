'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { desactiverEnseignantAction } from './actions';

export function DesactiverEnseignantButton({ enseignantId }: { enseignantId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="destructive"
        size="sm"
        disabled={pending}
        onClick={() => {
          if (!window.confirm('Désactiver cet enseignant ? Cette action est réversible par un directeur.'))
            return;
          startTransition(async () => {
            const result = await desactiverEnseignantAction(enseignantId);
            setError(result);
          });
        }}
      >
        Désactiver
      </Button>
      {error && <p className="text-body-sm text-error">{error}</p>}
    </div>
  );
}

'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { retirerDuProgrammeAction } from './actions';

export function RetirerButton({ id }: { id: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant="destructive"
        disabled={pending}
        onClick={() => {
          if (!window.confirm('Retirer cette matière du programme ?')) return;
          startTransition(async () => {
            const result = await retirerDuProgrammeAction(id);
            setError(result);
          });
        }}
      >
        Retirer
      </Button>
      {error && <p className="text-body-sm text-error">{error}</p>}
    </div>
  );
}

'use client';

import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { desactiver } from './actions';

export function DesactiverButton({ utilisateurId }: { utilisateurId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="destructive"
      size="sm"
      disabled={pending}
      onClick={() => startTransition(() => desactiver(utilisateurId))}
    >
      {pending ? '...' : 'Désactiver'}
    </Button>
  );
}

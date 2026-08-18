'use client';

import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { activerAnnee } from './actions';

export function ActiverAnneeButton({ anneeScolaireId }: { anneeScolaireId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={pending}
      onClick={() => startTransition(() => activerAnnee(anneeScolaireId))}
    >
      {pending ? 'Activation...' : 'Activer'}
    </Button>
  );
}

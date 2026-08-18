'use client';

import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { activerCycleAction } from './actions';

export function ActiverCycleButton({ cycleId }: { cycleId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={pending}
      onClick={() => startTransition(() => activerCycleAction(cycleId))}
    >
      {pending ? 'Activation...' : 'Activer'}
    </Button>
  );
}

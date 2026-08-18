'use client';

import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { suspendre } from './actions';

export function SuspendreButton({ abonnementId }: { abonnementId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="destructive"
      size="sm"
      disabled={pending}
      onClick={() => startTransition(() => suspendre(abonnementId))}
    >
      {pending ? '...' : 'Suspendre'}
    </Button>
  );
}

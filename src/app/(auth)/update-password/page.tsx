'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { GraduationCap } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { updatePassword } from './actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="mt-2 w-full" disabled={pending}>
      {pending ? 'Mise à jour...' : 'Mettre à jour le mot de passe'}
    </Button>
  );
}

export default function UpdatePasswordPage() {
  const [error, formAction] = useFormState(updatePassword, null);

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface p-gutter">
      <div className="flex w-full max-w-[440px] flex-col gap-6 rounded-xl border border-surface-border bg-surface-container-lowest p-container-pad shadow-floating">
        <header className="flex flex-col items-center gap-4 text-center">
          <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-lg bg-surface-container-low text-primary">
            <GraduationCap className="h-8 w-8" aria-hidden />
          </div>
          <div>
            <h1 className="text-display-sm text-text-primary">Nouveau mot de passe</h1>
          </div>
        </header>

        <form action={formAction} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Nouveau mot de passe</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              className="h-row-standard"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirmation">Confirmer le mot de passe</Label>
            <Input
              id="confirmation"
              name="confirmation"
              type="password"
              autoComplete="new-password"
              required
              className="h-row-standard"
            />
          </div>
          {error && <p className="text-body-sm text-error">{error}</p>}
          <SubmitButton />
        </form>
      </div>
    </main>
  );
}

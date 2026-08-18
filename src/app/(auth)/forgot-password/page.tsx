'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { GraduationCap } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { requestPasswordReset } from './actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="mt-2 w-full" disabled={pending}>
      {pending ? 'Envoi...' : 'Envoyer le lien de réinitialisation'}
    </Button>
  );
}

export default function ForgotPasswordPage() {
  const [message, formAction] = useFormState(requestPasswordReset, null);

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface p-gutter">
      <div className="flex w-full max-w-[440px] flex-col gap-6 rounded-xl border border-surface-border bg-surface-container-lowest p-container-pad shadow-floating">
        <header className="flex flex-col items-center gap-4 text-center">
          <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-lg bg-surface-container-low text-primary">
            <GraduationCap className="h-8 w-8" aria-hidden />
          </div>
          <div>
            <h1 className="text-display-sm text-text-primary">Mot de passe oublié</h1>
            <p className="mt-1 text-body-md text-text-secondary">
              Entrez votre email pour recevoir un lien de réinitialisation
            </p>
          </div>
        </header>

        {message ? (
          <p className="text-body-md text-text-secondary">{message}</p>
        ) : (
          <form action={formAction} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Adresse e-mail</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="nom@institution.edu"
                autoComplete="email"
                required
                className="h-row-standard"
              />
            </div>
            <SubmitButton />
          </form>
        )}

        <a
          href="/login"
          className="text-center text-label-md font-semibold text-primary hover:text-primary-container"
        >
          Retour à la connexion
        </a>
      </div>
    </main>
  );
}

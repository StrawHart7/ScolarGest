'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { GraduationCap } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { login, loginWithGoogle } from './actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="mt-2 w-full" disabled={pending}>
      {pending ? 'Connexion...' : 'Se connecter'}
    </Button>
  );
}

export default function LoginPage() {
  const [error, formAction] = useFormState(login, null);

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface p-gutter">
      <div className="flex w-full max-w-[440px] flex-col gap-6 rounded-xl border border-surface-border bg-surface-container-lowest p-container-pad shadow-floating">
        <header className="flex flex-col items-center gap-4 text-center">
          <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-lg bg-surface-container-low text-primary">
            <GraduationCap className="h-8 w-8" aria-hidden />
          </div>
          <div>
            <h1 className="text-display-sm text-text-primary">ScolarGest</h1>
            <p className="mt-1 text-body-md text-text-secondary">Connexion</p>
          </div>
        </header>

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
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Mot de passe</Label>
              <a
                href="/forgot-password"
                className="text-label-md font-semibold text-primary hover:text-primary-container"
              >
                Mot de passe oublié ?
              </a>
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="h-row-standard"
            />
          </div>
          {error && <p className="text-body-sm text-error">{error}</p>}
          <SubmitButton />
        </form>

        <div className="relative flex items-center py-2">
          <div className="flex-grow border-t border-surface-border" />
          <span className="flex-shrink-0 px-4 text-label-md text-text-secondary">ou</span>
          <div className="flex-grow border-t border-surface-border" />
        </div>

        <form action={loginWithGoogle}>
          <Button
            type="submit"
            variant="secondary"
            size="lg"
            className="h-row-standard w-full gap-2"
          >
            <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continuer avec Google
          </Button>
        </form>
      </div>
    </main>
  );
}

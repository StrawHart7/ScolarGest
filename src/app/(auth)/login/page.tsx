'use client';

import * as React from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { GraduationCap } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { login, loginWithGoogle } from './actions';

/**
 * Motifs de renvoi vers cette page depuis `/auth/callback`.
 *
 * Sans ces messages, un lien d'invitation qui echoue ramene sur un formulaire
 * de connexion muet : l'utilisateur ne sait ni ce qui s'est passe, ni quoi
 * faire. C'est exactement la panne signalee le 2026-08-31, ou trois causes
 * differentes produisaient le meme ecran silencieux.
 */
const MESSAGES_CALLBACK: Record<string, string> = {
  lien_invalide:
    "Ce lien n'est plus valide. Les liens d'invitation et de reinitialisation expirent, et ne servent qu'une fois. Demandez-en un nouveau.",
  session_introuvable:
    "Ce lien doit etre ouvert dans le navigateur qui a demarre la connexion. Reessayez depuis cet appareil, ou demandez un nouveau lien.",
  lien_incomplet:
    "Ce lien est incomplet. Copiez-le entierement depuis votre email, ou demandez-en un nouveau.",
  auth_callback_failed: "La connexion n'a pas abouti. Reessayez.",
  google_auth_failed: "La connexion Google n'a pas abouti. Reessayez.",
};

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
  // Lu apres montage plutot qu'avec `useSearchParams` : ce dernier impose une
  // frontiere `Suspense` sous Next 14 et fait echouer le build d'une page
  // prerendue. Le motif n'apparait qu'apres une redirection, jamais au premier
  // affichage, donc rien ne clignote.
  const [messageCallback, setMessageCallback] = React.useState<string | null>(null);
  React.useEffect(() => {
    const motif = new URLSearchParams(window.location.search).get('error');
    if (!motif) return;
    setMessageCallback(MESSAGES_CALLBACK[motif] ?? "La connexion n'a pas abouti. Reessayez.");
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface p-gutter">
      <div className="flex w-full max-w-[440px] flex-col gap-6 rounded-xl border border-surface-border bg-surface-container-lowest p-container-pad shadow-floating">
        {messageCallback && (
          <p className="rounded-lg border border-error/30 bg-error-container/40 p-3 text-body-sm text-text-primary">
            {messageCallback}
          </p>
        )}

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

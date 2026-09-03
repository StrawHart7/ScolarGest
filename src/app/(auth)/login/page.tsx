'use client';

import * as React from 'react';
import Link from 'next/link';
import { useFormState, useFormStatus } from 'react-dom';
import {
  GraduationCap,
  ArrowLeft,
  AlertCircle,
  Eye,
  EyeOff,
  Lock,
  History,
  ShieldCheck,
} from 'lucide-react';
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

/** Arguments de reassurance du panneau de gauche. */
const GARANTIES = [
  {
    icon: Lock,
    titre: 'Isolation par établissement',
    detail: 'Appliquée au niveau de la base de données, pas seulement dans le code.',
  },
  {
    icon: ShieldCheck,
    titre: 'Accès délimité par rôle',
    detail: 'Chacun ne voit que ce que son rôle autorise, ni plus, ni moins.',
  },
  {
    icon: History,
    titre: 'Traçabilité complète',
    detail: 'Chaque action sensible laisse une trace horodatée.',
  },
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="mt-1 h-11 w-full rounded-lg" disabled={pending}>
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
  const [motDePasseVisible, setMotDePasseVisible] = React.useState(false);

  React.useEffect(() => {
    const motif = new URLSearchParams(window.location.search).get('error');
    if (!motif) return;
    setMessageCallback(MESSAGES_CALLBACK[motif] ?? "La connexion n'a pas abouti. Reessayez.");
  }, []);

  return (
    <main className="grid min-h-svh grid-cols-1 lg:grid-cols-[1.05fr_1fr]">
      {/*
        Panneau de marque, masque sous `lg` : sur telephone il repousserait le
        formulaire sous la ligne de flottaison, or c'est la seule chose que
        l'utilisateur vient faire ici. Le repere de marque y est assure par la
        pastille au-dessus du titre, elle-meme masquee a partir de `lg` pour ne
        pas doubler le logo du panneau.
      */}
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-primary via-primary to-primary-container p-12 lg:flex lg:flex-col lg:justify-between">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-[420px] w-[420px] rounded-full border border-white/10"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -right-10 top-10 h-[280px] w-[280px] rounded-full border border-white/10"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-20 h-[360px] w-[360px] rounded-full bg-surface-tint/20 blur-3xl"
        />

        <Link href="/" className="relative z-10 flex w-fit items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/20 bg-white/10 backdrop-blur-md">
            <GraduationCap className="h-5 w-5 text-white" aria-hidden />
          </span>
          <span className="text-lg font-bold tracking-tight text-white">
            Scolar<span className="font-semibold text-primary-fixed-dim">Gest</span>
          </span>
        </Link>

        <div className="relative z-10 max-w-md">
          <h2 className="text-3xl font-extrabold leading-tight tracking-tight text-white">
            La gestion scolaire,
            <span className="block font-serif font-normal italic text-primary-fixed-dim">
              enfin unifiée.
            </span>
          </h2>
          <ul className="mt-8 flex flex-col gap-5">
            {GARANTIES.map(({ icon: Icon, titre, detail }) => (
              <li key={titre} className="flex gap-3.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/20 bg-white/10 backdrop-blur-md">
                  <Icon className="h-4 w-4 text-white" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{titre}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-primary-fixed-dim">{detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-xs text-white/50">
          © {new Date().getFullYear()} ScolarGest. Tous droits réservés.
        </p>
      </aside>

      <div className="relative flex items-center justify-center overflow-hidden bg-surface px-4 py-10 sm:px-6">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_0%,#ffffff_40%,#eaf0ff_100%)]"
        />

        <div className="relative z-10 w-full max-w-[420px]">
          <Link
            href="/"
            className="mb-6 inline-flex items-center gap-1.5 text-body-sm text-text-secondary transition-colors hover:text-primary-container"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Retour à l’accueil
          </Link>

          <div className="flex flex-col gap-6 rounded-2xl border border-surface-border bg-surface-container-lowest p-6 shadow-[0_20px_50px_-24px_rgba(9,30,66,0.35)] sm:p-8">
            <header className="flex flex-col gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary-container to-primary shadow-md lg:hidden">
                <GraduationCap className="h-6 w-6 text-white" aria-hidden />
              </span>
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-text-primary">
                  Bon retour
                </h1>
                <p className="mt-1 text-body-md text-text-secondary">
                  Connectez-vous à l’espace de votre établissement.
                </p>
              </div>
            </header>

            {messageCallback && (
              <p
                role="status"
                className="flex gap-2.5 rounded-lg border border-error/30 bg-error-container/40 p-3 text-body-sm text-text-primary"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-error" aria-hidden />
                {messageCallback}
              </p>
            )}

            <form action={formAction} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Adresse e-mail</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="nom@institution.edu"
                  autoComplete="email"
                  required
                  className="h-11 rounded-lg"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Mot de passe</Label>
                  <a
                    href="/forgot-password"
                    className="text-label-md font-semibold text-primary-container hover:text-primary"
                  >
                    Mot de passe oublié ?
                  </a>
                </div>
                {/*
                  Bascule de visibilite : sur telephone, une saisie masquee est
                  la premiere cause d'echec de connexion repete. Le bouton porte
                  `tabIndex={-1}` pour ne pas s'intercaler entre le champ et le
                  bouton d'envoi au clavier.
                */}
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={motDePasseVisible ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    className="h-11 rounded-lg pr-11"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setMotDePasseVisible((visible) => !visible)}
                    aria-label={
                      motDePasseVisible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'
                    }
                    className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-container hover:text-text-primary"
                  >
                    {motDePasseVisible ? (
                      <EyeOff className="h-4 w-4" aria-hidden />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <p role="alert" className="flex gap-2 text-body-sm text-error">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  {error}
                </p>
              )}

              <SubmitButton />
            </form>

            <div className="relative flex items-center">
              <div className="flex-grow border-t border-surface-border" />
              <span className="flex-shrink-0 px-4 text-label-md text-text-secondary">ou</span>
              <div className="flex-grow border-t border-surface-border" />
            </div>

            <form action={loginWithGoogle}>
              <Button
                type="submit"
                variant="secondary"
                size="lg"
                className="h-11 w-full gap-2 rounded-lg"
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

          <p className="mt-6 text-center text-xs text-text-secondary">
            Pas encore d’espace pour votre école ?{' '}
            <Link href="/#demo" className="font-semibold text-primary-container hover:text-primary">
              Demander une démo
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

import Link from 'next/link';
import { KeyRound, LogOut, UserRound } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { getMonProfil } from '@/services/utilisateur';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { getSidebarItems } from '@/lib/navigation';
import { PinForm } from '../PinForm';
import { DeconnexionButton } from './DeconnexionButton';

export default async function ParametresPage() {
  const ctx = await getTenantContext();
  const profil = await getMonProfil();
  const peutDefinirPin = profil.role === 'DIRECTEUR' || profil.role === 'SECRETAIRE';

  return (
    <AppLayout
      items={getSidebarItems(ctx.role)}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-display-sm text-text-primary">Paramètres</h1>
          <p className="text-body-sm text-text-secondary">
            Réglages de votre compte. Les réglages de l&apos;établissement se trouvent dans la
            section Établissement.
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-headline-sm text-text-primary">Compte</h2>

          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-surface-border bg-surface-container-lowest px-5 py-4">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-white">
              <UserRound className="h-[18px] w-[18px]" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-body-md text-text-primary">
                {profil.prenom} {profil.nom}
              </p>
              <p className="text-body-sm text-text-secondary">{profil.email}</p>
            </div>
            <Button asChild variant="secondary" size="sm">
              <Link href="/profil">Voir mon profil</Link>
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-surface-border bg-surface-container-lowest px-5 py-4">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-primary-fixed text-primary-container">
              <KeyRound className="h-[18px] w-[18px]" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-body-md text-text-primary">Mot de passe</p>
              <p className="text-body-sm text-text-secondary">
                La modification passe par un lien envoyé à votre adresse e-mail.
              </p>
            </div>
            <Button asChild variant="secondary" size="sm">
              <Link href="/forgot-password">Modifier</Link>
            </Button>
          </div>

          {peutDefinirPin && <PinForm pinConfigure={profil.pinConfigure} />}
        </section>

        <section className="space-y-3">
          <h2 className="text-headline-sm text-text-primary">Session</h2>
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-surface-border bg-surface-container-lowest px-5 py-4">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-error-container text-error-on-container">
              <LogOut className="h-[18px] w-[18px]" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-body-md text-text-primary">Se déconnecter</p>
              <p className="text-body-sm text-text-secondary">
                Ferme la session sur cet appareil uniquement.
              </p>
            </div>
            <DeconnexionButton />
          </div>
        </section>
      </div>
    </AppLayout>
  );
}

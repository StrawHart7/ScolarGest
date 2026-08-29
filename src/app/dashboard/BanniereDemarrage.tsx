'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Settings2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { masquerOnboardingAction } from '@/app/demarrage/actions';
import { appelerAction } from '@/app/demarrage/appel-action';

/**
 * Rappel de configuration inachevée sur le tableau de bord.
 *
 * La redirection vers `/demarrage` n'a lieu qu'une seule fois, à la première
 * arrivée : ensuite c'est cette bannière qui prend le relais, pour que
 * l'utilisateur garde la main sur le moment où il reprend. Elle est
 * refermable, et ce choix est mémorisé.
 */
export function BanniereDemarrage({
  nombreFaites,
  nombreTotal,
}: {
  nombreFaites: number;
  nombreTotal: number;
}) {
  const router = useRouter();
  const [masquee, setMasquee] = React.useState(false);

  if (masquee) return null;

  async function masquer() {
    // Fermeture optimiste : le rappel disparaît tout de suite. Si l'appel
    // échoue, la bannière réapparaîtra au prochain chargement — c'est sans
    // conséquence, contrairement à une étape de configuration.
    setMasquee(true);
    await appelerAction(() => masquerOnboardingAction());
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary-container/25 bg-primary-container/5 p-4">
      <span
        aria-hidden
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary-container/10 text-primary-container"
      >
        <Settings2 className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-body-md font-medium text-text-primary">Configuration inachevée</p>
        <p className="text-body-sm text-text-secondary">
          {nombreFaites} étape{nombreFaites > 1 ? 's' : ''} sur {nombreTotal}. Reprenez où vous en
          étiez pour rendre l&apos;établissement pleinement utilisable.
        </p>
      </div>
      <Button asChild size="sm" className="gap-2">
        <Link href="/demarrage">
          Reprendre
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </Button>
      <button
        type="button"
        onClick={masquer}
        aria-label="Masquer ce rappel"
        className="rounded p-1 text-text-secondary transition-colors hover:bg-surface-container hover:text-text-primary"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

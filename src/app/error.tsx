'use client';

import * as React from 'react';
import Link from 'next/link';
import * as Sentry from '@sentry/nextjs';
import { ShieldAlert, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

/**
 * Frontière d'erreur de l'espace applicatif.
 *
 * Sans elle, une garde `requireRole` qui lève produisait « Application error:
 * a client-side exception has occurred » — un écran blanc, non traduit, sans
 * issue, et qui ressemble à une panne alors que le produit fonctionne
 * exactement comme prévu. Découvert en Phase 9 en testant l'accès d'une
 * Secrétaire à `/super-admin`.
 *
 * On distingue les deux cas, parce qu'ils appellent des gestes différents :
 * un refus d'accès demande de revenir en arrière, une panne demande de
 * réessayer puis d'alerter.
 */

/** Message des gardes de `requireRole`, voir `src/services/authorization.ts`. */
const MOTIF_ACCES = /accès refusé|acces refuse/i;

export default function Erreur({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const refusAcces = MOTIF_ACCES.test(error.message);

  React.useEffect(() => {
    // Un refus d'accès n'est pas un incident : c'est le produit qui fait son
    // travail. Le remonter à Sentry noierait les vraies pannes sous le bruit
    // de chaque utilisateur qui tape une URL à laquelle il n'a pas droit.
    if (!refusAcces) Sentry.captureException(error);
  }, [error, refusAcces]);

  return (
    <div className="grid min-h-[60vh] place-items-center p-6">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          {refusAcces ? (
            <ShieldAlert className="h-12 w-12 text-text-secondary/60" aria-hidden />
          ) : (
            <TriangleAlert className="h-12 w-12 text-error" aria-hidden />
          )}

          <h1 className="text-headline-sm text-text-primary">
            {refusAcces ? 'Accès refusé' : 'Une erreur est survenue'}
          </h1>

          <p className="text-body-sm text-text-secondary">
            {refusAcces
              ? "Votre rôle ne donne pas accès à cette page. Si vous pensez qu'il s'agit d'une erreur, contactez la direction de votre établissement."
              : "La page n'a pas pu être affichée. Réessayez ; si le problème persiste, signalez-le en précisant la référence ci-dessous."}
          </p>

          {!refusAcces && error.digest && (
            <p className="text-label-md text-text-secondary" data-mono>
              Référence : {error.digest}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            {!refusAcces && (
              <Button onClick={reset} size="sm">
                Réessayer
              </Button>
            )}
            <Button asChild variant="secondary" size="sm">
              <Link href="/dashboard">Retour au tableau de bord</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

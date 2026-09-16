'use client';

import * as React from 'react';
import Link from 'next/link';
import * as Sentry from '@sentry/nextjs';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScolaIllustration } from '@/components/scola/illustration';
import { Card, CardContent } from '@/components/ui/card';
import { SignalerIncident } from '@/components/erreur/SignalerIncident';
import { normaliserRoute } from '@/lib/telemetrie';
import { deposer } from '@/lib/signalement-differe';
import { signalerErreurAction } from '@/app/erreur-actions';

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

/**
 * Les empreintes déjà signalées pendant ce chargement de page.
 *
 * La base borne déjà le débit — une occurrence par minute et par école — mais
 * elle incrémente le compteur d'occurrences à **chaque** appel, délibérément :
 * ce compteur doit dire la vérité. C'est donc ici qu'on évite de l'appeler pour
 * rien, quand React remonte la frontière ou qu'un utilisateur clique
 * « Réessayer » sur une panne qui se reproduit à l'identique.
 *
 * Le plafond est un coupe-circuit et non une commodité : vingt défauts
 * distincts sur un seul chargement ne sont plus des incidents à compter, c'est
 * une page qui part en vrille, et continuer à écrire ne renseignerait plus
 * personne.
 */
const dejaSignalees = new Set<string>();
const PLAFOND_SIGNALEMENTS = 20;

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
    // travail. Le remonter noierait les vraies pannes sous le bruit de chaque
    // utilisateur qui tape une URL à laquelle il n'a pas droit. Vaut pour
    // Sentry comme pour la Régie.
    if (refusAcces) return;

    Sentry.captureException(error);

    // Sentry garde le détail d'une panne ; la Régie en tient le dénombrement —
    // combien d'écoles distinctes, depuis quand, corrélé au flux d'événements
    // et aux drapeaux. Ce ne sont pas deux copies du même outil, et c'est
    // pourquoi rien de ce qui part ici ne porte de message ni de trace.
    //
    // Tant que cet appel n'existait pas, l'écran « Erreurs » de la Régie était
    // structurellement vide — et un écran vide s'y lit « rien ne casse ».
    const route = normaliserRoute(
      typeof window === 'undefined' ? '/' : window.location.pathname,
    );
    const cle = [error.name, route, error.digest ?? ''].join('|');

    if (dejaSignalees.has(cle) || dejaSignalees.size >= PLAFOND_SIGNALEMENTS) return;
    dejaSignalees.add(cle);

    // L'appel est laissé flottant, contrairement à `emettreEvenement` : on est
    // dans un effet de composant, pas dans une fonction serverless qu'une
    // réponse rendue ferait tuer. Et son échec ne doit rien changer à l'écran —
    // la promesse rejetée d'un effet remonterait sinon en erreur non gérée dans
    // la page qui sert justement à afficher une erreur.
    //
    // **Mais l'échec ne se jette plus.** Constaté en production le 2026-09-13 :
    // une erreur « Failed to fetch » à 12:43, le réseau revenu à 12:47, et la
    // Régie restée à zéro. Cet appel est une Server Action, donc un appel
    // réseau, lancé au moment précis où le réseau vient de tomber — c'est-à-dire
    // très exactement le cas où il y avait quelque chose à signaler. Le
    // signalement est donc déposé, et rejoué au prochain chargement réussi.
    void signalerErreurAction({
      nom: error.name,
      chemin: route,
      reference: error.digest ?? null,
    }).catch(() => {
      deposer({
        nom: error.name,
        chemin: route,
        reference: error.digest ?? null,
        quand: Date.now(),
      });
    });
  }, [error, refusAcces]);

  return (
    <div className="grid min-h-[60vh] place-items-center p-6">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          {/*
            Scola sur la panne, le bouclier sur le refus — et la distinction
            n'est pas décorative. Une panne est de notre fait : la mascotte peut
            l'assumer, et c'est même ce qui désamorce. Un refus d'accès, lui, est
            le produit qui fonctionne : y mettre une mascotte reviendrait à
            s'excuser d'une règle, et à laisser croire qu'elle est négociable.

            L'état est `surprised` et non `error` : le fantôme fâché a l'air de
            reprocher quelque chose à qui vient de perdre sa page.
          */}
          {refusAcces ? (
            <ShieldAlert className="h-12 w-12 text-text-secondary/60" aria-hidden />
          ) : (
            <ScolaIllustration etat="surprised" taille={92} />
          )}

          <h1 className="text-headline-sm text-text-primary">
            {refusAcces ? 'Accès refusé' : 'Quelque chose a lâché de mon côté'}
          </h1>

          <p className="text-body-sm text-text-secondary">
            {refusAcces
              ? "Votre rôle ne donne pas accès à cette page. Si vous pensez qu'il s'agit d'une erreur, contactez la direction de votre établissement."
              : "Je n'ai pas réussi à afficher cette page. Réessayez ; si ça recommence, dites-le-moi avec la référence ci-dessous et je transmets au support."}
          </p>

          {!refusAcces && error.digest && (
            <p className="text-label-md text-text-secondary" data-mono>
              Référence : {error.digest}
            </p>
          )}

          {/* Un refus d'acces n'a rien a signaler : le produit fonctionne. Y
              proposer le support enverrait au traitement humain ce qui est une
              regle de role, et noierait les vraies pannes — meme raisonnement
              que pour Sentry ci-dessus. */}
          {!refusAcces && (
            <div className="flex w-full justify-center pt-2">
              <SignalerIncident error={error} />
            </div>
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

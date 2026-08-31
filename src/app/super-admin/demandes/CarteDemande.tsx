'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Phone, MapPin, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { DemandeDemo, StatutDemande } from '@/services/demande-demo';
import { changerStatutAction } from './actions';

/**
 * Une demande de démo, avec son suivi commercial.
 *
 * Les coordonnées sont cliquables — `mailto:` et `tel:` — parce que l'action
 * la plus fréquente sur cet écran est de rappeler quelqu'un, pas de lire.
 *
 * Le changement de statut est optimiste en apparence mais confirmé par le
 * serveur : en cas d'échec, l'ancien statut revient et le message s'affiche.
 * Un bouton qui semble avoir fonctionné alors que rien n'a été enregistré est
 * pire qu'un bouton lent.
 */

const TON: Record<StatutDemande, 'neutral' | 'primary' | 'success' | 'warning'> = {
  NOUVELLE: 'primary',
  CONTACTEE: 'warning',
  CONVERTIE: 'success',
  REJETEE: 'neutral',
};

const LIBELLE: Record<StatutDemande, string> = {
  NOUVELLE: 'Nouvelle',
  CONTACTEE: 'Contactée',
  CONVERTIE: 'Convertie',
  REJETEE: 'Rejetée',
};

const SUIVANTS: Record<StatutDemande, StatutDemande[]> = {
  NOUVELLE: ['CONTACTEE', 'REJETEE'],
  CONTACTEE: ['CONVERTIE', 'REJETEE'],
  CONVERTIE: ['CONTACTEE'],
  REJETEE: ['NOUVELLE'],
};

function ilYA(iso: string): string {
  const jours = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (jours === 0) return "aujourd'hui";
  if (jours === 1) return 'hier';
  return `il y a ${jours} jours`;
}

export function CarteDemande({ demande }: { demande: DemandeDemo }) {
  const router = useRouter();
  const [statut, setStatut] = React.useState<StatutDemande>(demande.statut);
  const [enCours, setEnCours] = React.useState(false);
  const [erreur, setErreur] = React.useState<string | null>(null);

  async function changer(nouveau: StatutDemande) {
    const precedent = statut;
    setErreur(null);
    setStatut(nouveau);
    setEnCours(true);
    let resultat: Awaited<ReturnType<typeof changerStatutAction>> | undefined;
    try {
      resultat = await changerStatutAction(demande.id, nouveau);
    } catch {
      resultat = undefined;
    }
    setEnCours(false);
    if (!resultat || !resultat.ok) {
      setStatut(precedent);
      setErreur(resultat?.message ?? 'Connexion interrompue. Réessayez.');
      return;
    }
    router.refresh();
  }

  // Une demande jamais traitée depuis plus de trois jours mérite d'être vue de
  // loin : c'est le prospect qu'on est en train de perdre.
  const enRetard =
    statut === 'NOUVELLE' && Date.now() - new Date(demande.createdAt).getTime() > 3 * 86_400_000;

  return (
    <div
      className={cn(
        'flex flex-col gap-4 rounded-xl border bg-surface-container-lowest p-5 transition-colors',
        enRetard ? 'border-amber-500/40' : 'border-surface-border',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-body-md font-semibold text-text-primary">
            {demande.nomEtablissement}
          </p>
          <p className="text-body-sm text-text-secondary">{demande.nomContact}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {enRetard && (
            <Badge shape="pill" variant="warning">
              En retard
            </Badge>
          )}
          <Badge shape="pill" variant={TON[statut]}>
            {LIBELLE[statut]}
          </Badge>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-2 text-body-sm">
        <a
          href={`mailto:${demande.email}`}
          className="flex items-center gap-1.5 text-primary-container hover:underline"
        >
          <Mail className="h-3.5 w-3.5" aria-hidden />
          {demande.email}
        </a>
        {demande.telephone && (
          <a
            href={`tel:${demande.telephone}`}
            className="flex items-center gap-1.5 text-primary-container hover:underline"
          >
            <Phone className="h-3.5 w-3.5" aria-hidden />
            {demande.telephone}
          </a>
        )}
        {demande.ville && (
          <span className="flex items-center gap-1.5 text-text-secondary">
            <MapPin className="h-3.5 w-3.5" aria-hidden />
            {demande.ville}
          </span>
        )}
        <span className="flex items-center gap-1.5 text-text-secondary">
          <Clock className="h-3.5 w-3.5" aria-hidden />
          {ilYA(demande.createdAt)}
        </span>
      </div>

      {demande.message && (
        <p className="rounded-lg border-l-2 border-surface-border bg-surface-container-low p-3 text-body-sm leading-relaxed text-text-secondary">
          {demande.message}
        </p>
      )}

      {erreur && <p className="text-body-sm text-error">{erreur}</p>}

      <div className="flex flex-wrap gap-2 border-t border-surface-border pt-3">
        {SUIVANTS[statut].map((cible) => (
          <Button
            key={cible}
            size="sm"
            variant={cible === 'CONVERTIE' ? 'primary' : 'secondary'}
            disabled={enCours}
            onClick={() => changer(cible)}
          >
            Marquer {LIBELLE[cible].toLowerCase()}
          </Button>
        ))}
      </div>
    </div>
  );
}

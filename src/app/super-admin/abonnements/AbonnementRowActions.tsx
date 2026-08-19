'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { suspendre, reactiver, renouveler } from './actions';

/**
 * Actions de la console plateforme sur un abonnement. Le renouvellement
 * demande le plan de la période suivante — une école peut passer du mensuel à
 * l'annuel à cette occasion, c'est justement le moment de la conversion.
 */
export function AbonnementRowActions({
  abonnementId,
  statut,
  planActuelId,
  plans,
}: {
  abonnementId: string;
  statut: 'ACTIF' | 'EXPIRE' | 'SUSPENDU';
  planActuelId: string;
  plans: { id: string; nom: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [renouvellement, setRenouvellement] = useState(false);
  const [planId, setPlanId] = useState(planActuelId);

  if (renouvellement) {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-2">
          <Select value={planId} onValueChange={setPlanId}>
            <SelectTrigger className="h-8 w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {plans.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            disabled={pending}
            onClick={() => {
              setError(null);
              const formData = new FormData();
              formData.set('abonnementId', abonnementId);
              formData.set('planId', planId);
              startTransition(async () => {
                const message = await renouveler(null, formData);
                if (message) setError(message);
                else setRenouvellement(false);
              });
            }}
          >
            Confirmer
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setRenouvellement(false)}>
            Retour
          </Button>
        </div>
        {error && <p className="text-body-sm text-error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="secondary" onClick={() => setRenouvellement(true)}>
          Renouveler
        </Button>

        {statut === 'SUSPENDU' ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const message = await reactiver(abonnementId);
                if (message) setError(message);
              });
            }}
          >
            Réactiver
          </Button>
        ) : (
          <Button
            size="sm"
            variant="destructive"
            disabled={pending}
            onClick={() => startTransition(() => suspendre(abonnementId))}
          >
            Suspendre
          </Button>
        )}
      </div>
      {error && <p className="text-body-sm text-error">{error}</p>}
    </div>
  );
}

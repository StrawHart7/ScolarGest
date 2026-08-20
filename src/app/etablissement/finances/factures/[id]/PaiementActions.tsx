'use client';

import { useState, useTransition } from 'react';
import { FileText, Loader2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { annulerVersementAction, genererRecuAction } from './actions';

/**
 * Actions sur un versement encaissé : reçu PDF et annulation.
 * L'annulation demande un motif — c'est lui qui rend l'audit exploitable des
 * mois plus tard (chèque sans provision, erreur de saisie, doublon).
 */
export function PaiementActions({
  paiementId,
  factureId,
  annule,
  recuReference,
}: {
  paiementId: string;
  factureId: string;
  annule: boolean;
  recuReference: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saisieMotif, setSaisieMotif] = useState(false);
  const [motif, setMotif] = useState('');

  if (saisieMotif) {
    return (
      <div className="flex flex-col items-end gap-2">
        <div className="flex items-center gap-2">
          <Input
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder="Motif de l'annulation"
            className="h-8 w-56"
          />
          <Button
            size="sm"
            variant="secondary"
            disabled={pending || motif.trim().length === 0}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const message = await annulerVersementAction(paiementId, factureId, motif.trim());
                if (message) setError(message);
                else setSaisieMotif(false);
              });
            }}
          >
            Confirmer l&apos;annulation
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSaisieMotif(false)}>
            Retour
          </Button>
        </div>
        {error && <p className="text-body-sm text-error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={pending || annule}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await genererRecuAction(paiementId, factureId);
              if (result.error) setError(result.error);
              else if (result.url) window.open(result.url, '_blank', 'noopener,noreferrer');
            });
          }}
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <FileText className="h-4 w-4" aria-hidden />
          )}
          {recuReference ? 'Regénérer le reçu' : 'Générer le reçu'}
        </Button>

        {!annule && (
          <Button size="sm" variant="ghost" onClick={() => setSaisieMotif(true)}>
            <XCircle className="h-4 w-4" aria-hidden />
            Annuler
          </Button>
        )}
      </div>
      {error && <p className="text-body-sm text-error">{error}</p>}
    </div>
  );
}

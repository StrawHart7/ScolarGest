'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { archiverEleveAction, annulerInscriptionAction } from './actions';

export function ArchiverEleveButton({ eleveId }: { eleveId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="destructive"
        size="sm"
        disabled={pending}
        onClick={() => {
          if (!window.confirm('Archiver cet élève ? Cette action est réversible par un directeur.')) return;
          startTransition(async () => {
            const result = await archiverEleveAction(eleveId);
            setError(result);
          });
        }}
      >
        Archiver
      </Button>
      {error && <p className="text-body-sm text-error">{error}</p>}
    </div>
  );
}

export function AnnulerInscriptionButton({
  eleveId,
  inscriptionId,
}: {
  eleveId: string;
  inscriptionId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="secondary"
        size="sm"
        disabled={pending}
        onClick={() => {
          if (!window.confirm('Annuler cette inscription ? La ligne est conservée avec un statut ANNULEE.'))
            return;
          startTransition(async () => {
            const result = await annulerInscriptionAction(eleveId, inscriptionId);
            setError(result);
          });
        }}
      >
        Annuler l&apos;inscription
      </Button>
      {error && <p className="text-body-sm text-error">{error}</p>}
    </div>
  );
}

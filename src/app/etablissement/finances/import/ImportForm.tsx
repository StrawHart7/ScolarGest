'use client';

import { useState, useTransition } from 'react';
import { UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ImportRapport } from '@/components/eleves/ImportRapport';
import { PAIEMENT_IMPORT_COLUMNS } from '@/lib/import/paiement-import-schema';
import { importerFichierPaiements, type ImportActionResult } from './actions';

export function ImportPaiementsForm({ anneeScolaireId }: { anneeScolaireId: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ImportActionResult | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await importerFichierPaiements(formData);
      setResult(res);
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-surface-border bg-surface-container-low p-4">
        <p className="mb-2 text-body-md font-medium text-text-primary">Gabarit de colonnes attendu</p>
        <p className="text-body-sm text-text-secondary">
          La première ligne du fichier Excel doit reprendre exactement ces en-têtes, dans cet ordre :
        </p>
        <code
          className="mt-2 block overflow-x-auto rounded bg-surface-container-lowest p-2 text-body-sm"
          data-mono
        >
          {PAIEMENT_IMPORT_COLUMNS.join(' | ')}
        </code>
        <p className="mt-3 text-body-sm text-text-secondary">
          L&apos;élève est identifié par son matricule et le versement est imputé sur sa facture de
          l&apos;année ciblée. Les mêmes règles qu&apos;une saisie manuelle s&apos;appliquent : un
          versement qui dépasserait le solde restant est rejeté, ligne par ligne, sans bloquer les
          autres.
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <input type="hidden" name="anneeScolaireId" value={anneeScolaireId} />
        <div className="flex items-center gap-3 rounded-lg border border-dashed border-surface-border p-4">
          <UploadCloud className="h-6 w-6 text-text-secondary" aria-hidden />
          <input
            type="file"
            name="fichier"
            accept=".xlsx,.xls"
            required
            className="text-body-sm text-text-primary"
          />
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? 'Import en cours...' : 'Importer les versements'}
          </Button>
        </div>
      </form>

      {result && (
        <>
          {result.message && !result.ok && (
            <p className="text-body-sm text-error">{result.message}</p>
          )}
          <ImportRapport rapport={result.rapport} erreursValidation={result.erreursValidation} />
        </>
      )}
    </div>
  );
}

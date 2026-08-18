'use client';

import { useRef, useState, useTransition } from 'react';
import { UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EnseignantImportRapport } from '@/components/enseignants/EnseignantImportRapport';
import { ENSEIGNANT_IMPORT_COLUMNS } from '@/lib/import/enseignant-import-schema';
import { importerFichierEnseignants, type ImportActionResult } from './actions';

export function ImportForm({ anneeScolaireId }: { anneeScolaireId: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ImportActionResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await importerFichierEnseignants(formData);
      setResult(res);
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-surface-border bg-surface-container-low p-4">
        <p className="mb-2 text-body-md font-medium text-text-primary">Gabarit de colonnes attendu</p>
        <p className="text-body-sm text-text-secondary">
          La première ligne du fichier Excel doit reprendre exactement ces en-têtes, dans cet ordre.
          Une ligne = un enseignant + une affectation (classe × matière) : répétez la ligne (mêmes
          nom/prénoms/email) pour chaque affectation supplémentaire du même enseignant.
        </p>
        <code className="mt-2 block overflow-x-auto rounded bg-surface-container-lowest p-2 text-body-sm" data-mono>
          {ENSEIGNANT_IMPORT_COLUMNS.join(' | ')}
        </code>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <input type="hidden" name="anneeScolaireId" value={anneeScolaireId} />
        <div className="flex items-center gap-3 rounded-lg border border-dashed border-surface-border p-4">
          <UploadCloud className="h-6 w-6 text-text-secondary" aria-hidden />
          <input
            ref={fileInputRef}
            type="file"
            name="fichier"
            accept=".xlsx,.xls"
            required
            className="text-body-sm text-text-primary"
          />
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? 'Import en cours...' : 'Importer'}
          </Button>
        </div>
      </form>

      {result && (
        <>
          {result.message && !result.ok && <p className="text-body-sm text-error">{result.message}</p>}
          <EnseignantImportRapport rapport={result.rapport} erreursValidation={result.erreursValidation} />
        </>
      )}
    </div>
  );
}

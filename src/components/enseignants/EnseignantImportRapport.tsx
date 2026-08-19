import { CheckCircle2, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { ImportRapport as ImportRapportType } from '@/services/import-enseignants';
import type { LigneErreur } from '@/lib/import/enseignant-import-schema';

export function EnseignantImportRapport({
  rapport,
  erreursValidation,
}: {
  rapport?: ImportRapportType;
  erreursValidation?: LigneErreur[];
}) {
  return (
    <div className="space-y-4">
      {erreursValidation && erreursValidation.length > 0 && (
        <div className="rounded-lg border border-error/30 bg-error/5 p-4">
          <p className="mb-2 flex items-center gap-2 text-body-md font-medium text-error">
            <XCircle className="h-4 w-4" aria-hidden />
            {erreursValidation.length} ligne(s) rejetée(s) à la validation
          </p>
          <ul className="space-y-1 text-body-sm text-text-secondary">
            {erreursValidation.map((e, i) => (
              <li key={i}>
                Ligne {e.ligne} — {e.champ} : {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {rapport && (
        <div className="rounded-lg border border-surface-border p-4">
          <div className="mb-3 flex items-center gap-3">
            <Badge variant="success" shape="pill">
              {rapport.succes} réussi(s)
            </Badge>
            {rapport.echecs > 0 && (
              <Badge variant="error" shape="pill">
                {rapport.echecs} échec(s)
              </Badge>
            )}
            <span className="text-body-sm text-text-secondary">
              {rapport.totalLignes} ligne(s) traitée(s)
            </span>
          </div>
          <ul className="space-y-1 text-body-sm">
            {rapport.details.map((d) => (
              <li key={d.ligne} className="flex items-center gap-2">
                {d.ok ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-tertiary" aria-hidden />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0 text-error" aria-hidden />
                )}
                <span className="text-text-primary">Ligne {d.ligne}:</span>
                <span className="text-text-secondary">{d.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useTransition } from 'react';
import { RefreshCw, Loader2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { regenererBulletinAction } from '@/app/etablissement/notes/bulletins/actions';

const PERIODES = [
  { value: 'TRIMESTRE_1', label: '1er trimestre' },
  { value: 'TRIMESTRE_2', label: '2e trimestre' },
  { value: 'TRIMESTRE_3', label: '3e trimestre' },
];

/**
 * L'entité Document ne conserve pas la période d'origine (schéma Phase 5
 * figé sur la table `document` telle que définie en Phase 0 — voir
 * 0001_init.sql). La régénération reconstruit donc le contexte
 * (classe/année en cours pour l'élève, déjà connues) et demande la période à
 * l'utilisateur, cohérent avec la consigne du plan ("reconstruits depuis
 * objetId + contexte").
 */
export function RegenererBulletinButton({
  documentId,
  classeId,
  anneeScolaireId,
  eleveId,
}: {
  documentId: string;
  classeId: string;
  anneeScolaireId: string;
  eleveId: string;
}) {
  const [periode, setPeriode] = useState('TRIMESTRE_1');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <Select value={periode} onValueChange={setPeriode}>
          <SelectTrigger className="h-8 w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODES.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() => {
            if (!window.confirm('Régénérer ce bulletin ? Le document actuel passera au statut OBSOLETE.'))
              return;
            setError(null);
            startTransition(async () => {
              const result = await regenererBulletinAction(documentId, classeId, periode, anneeScolaireId, eleveId);
              if (result.error) {
                setError(result.error);
                return;
              }
              if (result.url) window.open(result.url, '_blank', 'noopener,noreferrer');
            });
          }}
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
          Régénérer
        </Button>
      </div>
      {error && <p className="text-body-sm text-error">{error}</p>}
    </div>
  );
}

export function TelechargerBulletinLink({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-body-sm text-primary hover:underline"
    >
      <Download className="h-4 w-4" aria-hidden />
      Télécharger
    </a>
  );
}

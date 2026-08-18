'use client';

import { useState, useTransition } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { definirTitulaireAction, retirerTitulaireAction } from './actions';

interface EnseignantOption {
  id: string;
  nom: string;
  prenoms: string;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Enregistrement...' : 'Définir le titulaire'}
    </Button>
  );
}

export function TitulariteControls({
  classeId,
  anneeScolaireId,
  enseignants,
  titulaire,
}: {
  classeId: string;
  anneeScolaireId: string;
  enseignants: EnseignantOption[];
  titulaire: { enseignantId: string; enseignant: { nom: string; prenoms: string } } | null;
}) {
  const [error, formAction] = useFormState(definirTitulaireAction, null);
  const [enseignantId, setEnseignantId] = useState('');
  const [pendingRemove, startTransition] = useTransition();
  const [removeError, setRemoveError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      {titulaire && (
        <div className="flex items-center justify-between rounded-lg border border-surface-border p-3">
          <div>
            <p className="text-body-sm text-text-secondary">Titulaire actuel</p>
            <p className="text-body-md text-text-primary">
              {titulaire.enseignant.nom} {titulaire.enseignant.prenoms}
              <Badge variant="primary" className="ml-2">
                Titulaire
              </Badge>
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            disabled={pendingRemove}
            onClick={() => {
              if (!window.confirm('Retirer le titulaire de cette classe ?')) return;
              startTransition(async () => {
                const result = await retirerTitulaireAction(classeId);
                setRemoveError(result);
              });
            }}
          >
            Retirer
          </Button>
        </div>
      )}
      {removeError && <p className="text-body-sm text-error">{removeError}</p>}

      <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <input type="hidden" name="classeId" value={classeId} />
        <input type="hidden" name="anneeScolaireId" value={anneeScolaireId} />
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="enseignantId">{titulaire ? 'Remplacer le titulaire' : 'Choisir un titulaire'}</Label>
          <Select name="enseignantId" value={enseignantId} onValueChange={setEnseignantId} required>
            <SelectTrigger id="enseignantId">
              <SelectValue placeholder="Choisir un enseignant" />
            </SelectTrigger>
            <SelectContent>
              {enseignants.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.nom} {e.prenoms}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <SubmitButton />
      </form>
      {error && <p className="text-body-sm text-error">{error}</p>}
    </div>
  );
}

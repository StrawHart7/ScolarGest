'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { definirCoefficientAction } from './actions';

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="secondary" disabled={pending}>
      {pending ? '...' : 'Enregistrer'}
    </Button>
  );
}

export function CoefficientRow({
  programmeEtablissementId,
  anneeScolaireId,
  serieId,
  coefficientActuel,
}: {
  programmeEtablissementId: string;
  anneeScolaireId: string;
  serieId: string | null;
  coefficientActuel: number | null;
}) {
  const [error, formAction] = useFormState(definirCoefficientAction, null);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="programmeEtablissementId" value={programmeEtablissementId} />
      <input type="hidden" name="anneeScolaireId" value={anneeScolaireId} />
      {serieId && <input type="hidden" name="serieId" value={serieId} />}
      <Input
        name="coefficient"
        type="number"
        min={0}
        step="0.5"
        defaultValue={coefficientActuel ?? ''}
        placeholder="—"
        className="w-20"
      />
      <SaveButton />
      {error && <p className="text-body-sm text-error">{error}</p>}
    </form>
  );
}

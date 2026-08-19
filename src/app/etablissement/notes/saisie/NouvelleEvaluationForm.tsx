'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Button } from '@/components/ui/button';
import type { Periode, TypeEvaluation } from '@/services/evaluation';
import { creerEvaluationAction } from './actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Création...' : "Créer l'évaluation"}
    </Button>
  );
}

export function NouvelleEvaluationForm({
  anneeScolaireId,
  classeId,
  matiereId,
  periode,
}: {
  anneeScolaireId: string;
  classeId: string;
  matiereId: string;
  periode: Periode;
}) {
  const [error, formAction] = useFormState(creerEvaluationAction, null);
  const [type, setType] = useState<TypeEvaluation>('INTERROGATION');
  const [numero, setNumero] = useState('1');

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="anneeScolaireId" value={anneeScolaireId} />
      <input type="hidden" name="classeId" value={classeId} />
      <input type="hidden" name="matiereId" value={matiereId} />
      <input type="hidden" name="periode" value={periode} />

      <div className="grid grid-cols-1 gap-gutter sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="type">Type</Label>
          <Select value={type} onValueChange={(v) => setType(v as TypeEvaluation)} name="type">
            <SelectTrigger id="type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="INTERROGATION">Interrogation</SelectItem>
              <SelectItem value="DEVOIR">Devoir</SelectItem>
              <SelectItem value="COMPOSITION">Composition</SelectItem>
            </SelectContent>
          </Select>
          <input type="hidden" name="type" value={type} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="numero">
            Numéro {type === 'INTERROGATION' && <span className="normal-case text-text-secondary">(max 3)</span>}
          </Label>
          <Input
            id="numero"
            name="numero"
            type="number"
            min={1}
            max={type === 'INTERROGATION' ? 3 : undefined}
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="date">Date</Label>
          <DatePicker id="date" name="date" />
        </div>
      </div>

      {error && <p className="text-body-sm text-error">{error}</p>}
      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
  );
}

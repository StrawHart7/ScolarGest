'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Label } from '@/components/ui/label';
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

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="anneeScolaireId" value={anneeScolaireId} />
      <input type="hidden" name="classeId" value={classeId} />
      <input type="hidden" name="matiereId" value={matiereId} />
      <input type="hidden" name="periode" value={periode} />

      {/*
        Le champ « Numéro » est parti le 2026-09-15, avec son plafond de trois
        interrogations. Le numéro n'apparaît nulle part — ni sur le bulletin, ni
        dans le calcul des moyennes — et le plafond n'avait pas de sens : le
        moteur divise par le nombre d'interrogations, quatre donnent un résultat
        aussi cohérent que trois.

        Il est déduit côté serveur : les interrogations s'incrémentent, le
        devoir et la composition valent toujours 1, ce qui les rend uniques par
        période — « composition du 1er trimestre » existe, « composition 2 »
        non.
      */}
      <div className="grid grid-cols-1 gap-gutter sm:grid-cols-2">
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
          <Label htmlFor="date">Date</Label>
          <DatePicker id="date" name="date" />
        </div>
      </div>

      {/*
        Ce qu'il fallait dire à la place du numéro. Des professeurs notent sur
        10 et faussent toute la moyenne de la classe, sans que rien ne les
        arrête : la saisie accepte 0 à 20, et une note sur 10 y entre sans
        broncher. Le dire au moment de créer l'évaluation, c'est le dire avant
        la faute plutôt qu'après.
      */}
      <p className="rounded-md bg-primary-container/10 p-3 text-body-sm text-text-secondary">
        Les notes se saisissent <strong className="text-text-primary">sur 20</strong>, quel que
        soit le type d&apos;évaluation. Une note sur 10 fausserait la moyenne de la classe.
        {type === 'INTERROGATION'
          ? ' Vous pouvez créer autant d’interrogations que nécessaire : la moyenne en tient compte.'
          : ' Il n’y en a qu’une par période.'}
      </p>

      {error && <p className="text-body-sm text-error">{error}</p>}
      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
  );
}

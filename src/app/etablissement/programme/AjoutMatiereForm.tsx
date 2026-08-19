'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ajouterAuProgrammeAction } from './actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Ajout...' : 'Ajouter au programme'}
    </Button>
  );
}

export function AjoutMatiereForm({
  niveauId,
  matieresDisponibles,
  prochainOrdre,
}: {
  niveauId: string;
  matieresDisponibles: { id: string; nom: string; code: string | null }[];
  prochainOrdre: number;
}) {
  const [error, formAction] = useFormState(ajouterAuProgrammeAction, null);

  if (matieresDisponibles.length === 0) {
    return (
      <p className="text-body-sm text-text-secondary">
        Toutes les matières actives du catalogue font déjà partie du programme de ce niveau.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="niveauId" value={niveauId} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="matiereId">Matière</Label>
        <Select name="matiereId" required key={niveauId}>
          <SelectTrigger id="matiereId" className="w-56">
            <SelectValue placeholder="Choisir une matière" />
          </SelectTrigger>
          <SelectContent>
            {matieresDisponibles.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.nom}
                {m.code ? ` (${m.code})` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ordreAffichage">Ordre d&apos;affichage</Label>
        <Input
          id="ordreAffichage"
          name="ordreAffichage"
          type="number"
          min={0}
          defaultValue={prochainOrdre}
          className="w-24"
        />
      </div>
      <div className="flex items-center gap-2 pb-2">
        <Checkbox id="obligatoire" name="obligatoire" defaultChecked />
        <Label htmlFor="obligatoire" className="cursor-pointer">
          Obligatoire
        </Label>
      </div>
      <SubmitButton />
      {error && <p className="w-full text-body-sm text-error">{error}</p>}
    </form>
  );
}

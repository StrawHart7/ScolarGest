'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { creerTarifAction } from './actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Enregistrement...' : 'Enregistrer le tarif'}
    </Button>
  );
}

export function TarifForm({
  anneeScolaireId,
  classes,
  typesFrais,
  defaultClasseId,
}: {
  anneeScolaireId: string;
  classes: { id: string; nom: string }[];
  typesFrais: { id: string; nom: string }[];
  defaultClasseId: string;
}) {
  const [error, formAction] = useFormState(creerTarifAction, null);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="anneeScolaireId" value={anneeScolaireId} />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="typeFraisId">Type de frais</Label>
          <Select name="typeFraisId" defaultValue={typesFrais[0]?.id ?? ''}>
            <SelectTrigger id="typeFraisId">
              <SelectValue placeholder="Sélectionnez un type de frais" />
            </SelectTrigger>
            <SelectContent>
              {typesFrais.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="classeId">Classe concernée</Label>
          <Select name="classeId" defaultValue={defaultClasseId || classes[0]?.id || ''}>
            <SelectTrigger id="classeId">
              <SelectValue placeholder="Sélectionnez une classe" />
            </SelectTrigger>
            <SelectContent>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="montant">Montant (FCFA)</Label>
          <Input
            id="montant"
            name="montant"
            type="number"
            min={0}
            step={1}
            placeholder="0"
            required
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton />
        {error && <p className="text-body-sm text-error">{error}</p>}
      </div>
    </form>
  );
}

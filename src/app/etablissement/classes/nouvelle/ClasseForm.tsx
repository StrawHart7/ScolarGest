'use client';

import { useMemo, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { creerClasse } from '../actions';

export interface CycleOption {
  id: string;
  nom: string;
  estLycee: boolean;
  niveaux: { id: string; nom: string }[];
  series: { id: string; nom: string }[];
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? 'Création...' : 'Créer la classe'}
    </Button>
  );
}

export function ClasseForm({
  anneeScolaireId,
  cycles,
}: {
  anneeScolaireId: string;
  cycles: CycleOption[];
}) {
  const [error, formAction] = useFormState(creerClasse, null);
  const [cycleId, setCycleId] = useState(cycles[0]?.id ?? '');

  const cycle = useMemo(() => cycles.find((c) => c.id === cycleId), [cycles, cycleId]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="anneeScolaireId" value={anneeScolaireId} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cycleId">Cycle</Label>
        <Select value={cycleId} onValueChange={setCycleId}>
          <SelectTrigger id="cycleId">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {cycles.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nom}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="niveauId">Niveau</Label>
        {/* key={cycleId} remounts on cycle change so a stale niveau from the
            previous cycle can never be silently submitted. */}
        <Select key={cycleId} name="niveauId" required>
          <SelectTrigger id="niveauId">
            <SelectValue placeholder="Choisir un niveau" />
          </SelectTrigger>
          <SelectContent>
            {cycle?.niveaux.map((n) => (
              <SelectItem key={n.id} value={n.id}>
                {n.nom}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {cycle?.estLycee && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="serieId">Série</Label>
          <Select key={cycleId} name="serieId" required>
            <SelectTrigger id="serieId">
              <SelectValue placeholder="Choisir une série" />
            </SelectTrigger>
            <SelectContent>
              {cycle.series.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nom">Nom de la classe</Label>
          <Input id="nom" name="nom" placeholder="6e A" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="capacite">Capacité</Label>
          <Input id="capacite" name="capacite" type="number" min={1} />
        </div>
      </div>

      {error && <p className="text-body-sm text-error">{error}</p>}
      <SubmitButton />
    </form>
  );
}

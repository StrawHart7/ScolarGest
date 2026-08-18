'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Info } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import type { Classe } from '@/services/classe';
import { inscrireEleve } from './actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? 'Inscription...' : "Confirmer l'inscription"}
    </Button>
  );
}

export function InscriptionForm({
  eleveId,
  anneeScolaireId,
  classes,
}: {
  eleveId: string;
  anneeScolaireId: string;
  classes: Classe[];
}) {
  const [error, formAction] = useFormState(inscrireEleve, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="eleveId" value={eleveId} />
      <input type="hidden" name="anneeScolaireId" value={anneeScolaireId} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="classeId">Classe</Label>
        <Select name="classeId" required>
          <SelectTrigger id="classeId">
            <SelectValue placeholder="Choisir une classe" />
          </SelectTrigger>
          <SelectContent>
            {classes.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nom} — {c.niveau.nom}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-surface-border bg-surface-container-low p-3 text-body-sm text-text-secondary">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p>
          La facture est générée automatiquement à partir des tarifs configurés pour cette classe. Si
          aucun tarif n&apos;est encore configuré, une facture à 0 FCFA sera créée (à corriger
          ultérieurement en Finances).
        </p>
      </div>

      {error && <p className="text-body-sm text-error">{error}</p>}
      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
  );
}

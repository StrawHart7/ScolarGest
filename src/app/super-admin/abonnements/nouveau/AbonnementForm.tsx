'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Button } from '@/components/ui/button';
import { creerAbonnement } from '../actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? 'Création...' : "Créer l'abonnement"}
    </Button>
  );
}

export function AbonnementForm({
  etablissements,
  plans,
}: {
  etablissements: { id: string; nom: string }[];
  plans: { id: string; nom: string; prix: number; duree: string }[];
}) {
  const [error, formAction] = useFormState(creerAbonnement, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="etablissementId">Établissement</Label>
        <Select name="etablissementId" required>
          <SelectTrigger id="etablissementId">
            <SelectValue placeholder="Choisir un établissement" />
          </SelectTrigger>
          <SelectContent>
            {etablissements.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.nom}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="planId">Plan</Label>
        <Select name="planId" required>
          <SelectTrigger id="planId">
            <SelectValue placeholder="Choisir un plan" />
          </SelectTrigger>
          <SelectContent>
            {plans.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.nom} — {Number(p.prix).toLocaleString('fr-FR')} FCFA / {p.duree}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dateDebut">Date de début</Label>
          <DatePicker id="dateDebut" name="dateDebut" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dateFin">Date de fin</Label>
          <DatePicker id="dateFin" name="dateFin" />
        </div>
      </div>

      {error && <p className="text-body-sm text-error">{error}</p>}
      <SubmitButton />
    </form>
  );
}

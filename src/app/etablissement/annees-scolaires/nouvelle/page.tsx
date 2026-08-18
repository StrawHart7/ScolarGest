'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { creerAnneeScolaire } from '../actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? 'Création...' : "Créer l'année scolaire"}
    </Button>
  );
}

export default function NouvelleAnneeScolairePage() {
  const [error, formAction] = useFormState(creerAnneeScolaire, null);

  return (
    <main className="mx-auto max-w-xl p-container-pad">
      <h1 className="mb-6 text-display-sm text-text-primary">Nouvelle année scolaire</h1>

      <form action={formAction} className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Détails</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="libelle">Libellé</Label>
              <Input id="libelle" name="libelle" placeholder="2026-2027" required />
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
            <p className="text-body-sm text-text-secondary">
              L&apos;année est créée en statut PRÉPARATION ; elle devra être activée séparément.
            </p>
          </CardContent>
        </Card>

        {error && <p className="text-body-sm text-error">{error}</p>}
        <SubmitButton />
      </form>
    </main>
  );
}

'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { enregistrerVersementAction } from './actions';

const MODES = [
  { value: 'ESPECES', label: 'Espèces' },
  { value: 'MOBILE_MONEY', label: 'Mobile Money' },
  { value: 'VIREMENT', label: 'Virement' },
  { value: 'CHEQUE', label: 'Chèque' },
  { value: 'AUTRE', label: 'Autre' },
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Enregistrement...' : "Valider l'encaissement"}
    </Button>
  );
}

export function NouveauVersementForm({
  factureId,
  solde,
}: {
  factureId: string;
  solde: number;
}) {
  const [error, formAction] = useFormState(enregistrerVersementAction, null);
  const [mode, setMode] = useState('ESPECES');
  const referenceRequise = mode !== 'ESPECES';
  const aujourdhui = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="factureId" value={factureId} />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="montant">Montant à encaisser (FCFA)</Label>
          <Input
            id="montant"
            name="montant"
            type="number" inputMode="numeric"
            min={1}
            max={solde}
            step={1}
            placeholder="0"
            required
          />
          <p className="text-body-sm text-text-secondary">
            Reste dû : {solde.toLocaleString('fr-FR')} FCFA
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="datePaiement">Date du versement</Label>
          <DatePicker id="datePaiement" name="datePaiement" defaultValue={aujourdhui} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="modePaiement">Mode de paiement</Label>
          <Select name="modePaiement" value={mode} onValueChange={setMode}>
            <SelectTrigger id="modePaiement">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODES.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reference">Référence de transaction</Label>
          <Input
            id="reference"
            name="reference"
            placeholder="Ex : CHQ-00123 ou TXN-987"
            required={referenceRequise}
          />
          <p className="text-body-sm text-text-secondary">
            {referenceRequise
              ? 'Requise pour un chèque, un virement ou un Mobile Money.'
              : 'Facultative pour un encaissement en espèces.'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton />
        {error && <p className="text-body-sm text-error">{error}</p>}
      </div>
    </form>
  );
}

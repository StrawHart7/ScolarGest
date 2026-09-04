'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { CheckCircle2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { enregistrerPaiement } from '../../actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full gap-2">
      <CheckCircle2 className="h-4 w-4" aria-hidden />
      {pending ? 'Validation...' : 'Confirmer le paiement'}
    </Button>
  );
}

export function PaiementForm({ abonnementId }: { abonnementId: string }) {
  const [error, formAction] = useFormState(enregistrerPaiement, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="abonnementId" value={abonnementId} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="montant">Montant reçu (FCFA)</Label>
        <Input id="montant" name="montant" type="number" inputMode="numeric" min={0} required />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="modePaiement">Mode de paiement</Label>
        <Select name="modePaiement" required defaultValue="VIREMENT">
          <SelectTrigger id="modePaiement">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="VIREMENT">Virement</SelectItem>
            <SelectItem value="MOBILE_MONEY">Mobile Money</SelectItem>
            <SelectItem value="ESPECES">Espèces</SelectItem>
            <SelectItem value="CHEQUE">Chèque</SelectItem>
            <SelectItem value="AUTRE">Autre</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reference">Référence (optionnel)</Label>
        <Input id="reference" name="reference" placeholder="N° de transaction" />
      </div>

      {error && <p className="text-body-sm text-error">{error}</p>}
      <SubmitButton />
    </form>
  );
}

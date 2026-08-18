'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { KeyRound, CheckCircle2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { definirPinAction } from './actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Enregistrement...' : 'Enregistrer le PIN'}
    </Button>
  );
}

export function PinForm({ pinConfigure }: { pinConfigure: boolean }) {
  const [result, formAction] = useFormState(definirPinAction, null);
  const success = result === 'OK';
  const error = result && !success ? result : null;

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-container/10 text-primary-container">
          <KeyRound className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <CardTitle>PIN d&apos;approbation</CardTitle>
          <p className="text-body-sm text-text-secondary">
            {pinConfigure
              ? 'Un PIN est déjà configuré. Le définir à nouveau le remplace.'
              : 'Requis pour approuver les notes et les actions sensibles.'}
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pin">Nouveau PIN (6 chiffres)</Label>
              <Input
                id="pin"
                name="pin"
                type="password"
                inputMode="numeric"
                maxLength={6}
                pattern="\d{6}"
                autoComplete="off"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirmation">Confirmation</Label>
              <Input
                id="confirmation"
                name="confirmation"
                type="password"
                inputMode="numeric"
                maxLength={6}
                pattern="\d{6}"
                autoComplete="off"
                required
              />
            </div>
          </div>

          {error && <p className="text-body-sm text-error">{error}</p>}
          {success && (
            <p className="flex items-center gap-1.5 text-body-sm text-tertiary">
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              PIN mis à jour avec succès.
            </p>
          )}

          <div>
            <SubmitButton />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

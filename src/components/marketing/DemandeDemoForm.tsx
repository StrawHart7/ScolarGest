'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { CheckCircle2 } from 'lucide-react';
import { submitDemandeDemo, type DemandeDemoState } from '@/app/demande-demo-actions';

const initialState: DemandeDemoState = { status: 'idle', message: '' };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? 'Envoi en cours…' : 'Demander ma démo'}
    </Button>
  );
}

export function DemandeDemoForm() {
  const [state, formAction] = useFormState(submitDemandeDemo, initialState);

  if (state.status === 'success') {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-tertiary/30 bg-tertiary-fixed/40 p-8 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-tertiary">
          <CheckCircle2 className="h-6 w-6 text-white" aria-hidden />
        </span>
        <p className="text-body-md font-medium text-text-primary">{state.message}</p>
        <p className="text-body-sm text-text-secondary">
          Nous revenons vers vous sous 48 heures.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="nomEtablissement">Nom de l&apos;établissement *</Label>
        <Input id="nomEtablissement" name="nomEtablissement" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="nomContact">Votre nom *</Label>
        <Input id="nomContact" name="nomContact" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email *</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="telephone">Téléphone</Label>
        <Input id="telephone" name="telephone" type="tel" inputMode="tel" />
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="ville">Ville</Label>
        <Input id="ville" name="ville" placeholder="Lomé, Kara..." />
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="message">Message (optionnel)</Label>
        <textarea
          id="message"
          name="message"
          rows={4}
          placeholder="Combien d’élèves ? Quels cycles ? Ce que vous utilisez aujourd’hui."
          className="flex w-full rounded border border-surface-border bg-surface-container-lowest px-3 py-2 text-body-md text-text-primary placeholder:text-text-secondary/60 focus-visible:border-primary-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container/20"
        />
      </div>

      {state.status === 'error' && (
        <p className="text-body-sm text-error sm:col-span-2">{state.message}</p>
      )}

      <div className="sm:col-span-2">
        <SubmitButton />
      </div>
    </form>
  );
}

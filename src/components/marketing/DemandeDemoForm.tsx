'use client';

import * as React from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2 } from 'lucide-react';
import { submitDemandeDemo, type DemandeDemoState } from '@/app/demande-demo-actions';
import { lireOrigine, LIBELLE_ORIGINE, type OrigineDemande } from '@/lib/origine-demande';

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

  /**
   * L'offre d'où vient le visiteur, lue dans l'adresse.
   *
   * `useEffect` sur `window.location.search`, et **non** `useSearchParams` :
   * ce dernier impose une frontière `Suspense` et fait échouer le build d'une
   * page prérendue — la page d'accueil en est une. Le piège est déjà consigné
   * dans `CLAUDE.md` à propos du motif d'erreur de `/login`.
   *
   * Le premier rendu vaut donc `DIRECT` côté serveur, corrigé à l'hydratation.
   * C'est sans conséquence : personne ne soumet un formulaire avant qu'il ne
   * soit hydraté.
   */
  const [origine, setOrigine] = React.useState<OrigineDemande>('DIRECT');
  React.useEffect(() => {
    setOrigine(lireOrigine(window.location.search));
  }, []);

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
      <input type="hidden" name="origine" value={origine} />

      {/* Le visiteur doit voir ce que le formulaire a retenu de son clic. Sans
          ce rappel, quelqu'un venu de « Rejoindre le programme » se retrouve
          devant un formulaire de démo générique et croit avoir perdu son
          choix — il le réécrit alors dans le message, ou renonce. */}
      {origine !== 'DIRECT' && (
        <p className="rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-body-sm text-text-primary sm:col-span-2">
          Votre demande porte sur : <strong className="font-semibold">{LIBELLE_ORIGINE[origine]}</strong>.
        </p>
      )}

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
        <Textarea
          id="message"
          name="message"
          rows={4}
          placeholder="Combien d’élèves ? Quels cycles ? Ce que vous utilisez aujourd’hui."
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

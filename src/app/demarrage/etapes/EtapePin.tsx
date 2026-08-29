'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ErreurEtape } from '../Bulles';
import { definirPinAction } from '../actions';

/**
 * Première étape du parcours, et elle ne peut pas être ailleurs : `exigerPin`
 * lève « Aucun PIN de confirmation n'est configuré » dès qu'on tente
 * d'activer une année ou un cycle. Sans ce code défini d'abord, les deux
 * étapes suivantes seraient bloquées.
 */
export function EtapePin({ onTermine }: { onTermine: () => void }) {
  const [pin, setPin] = React.useState('');
  const [confirmation, setConfirmation] = React.useState('');
  const [erreur, setErreur] = React.useState<string | null>(null);
  const [enCours, setEnCours] = React.useState(false);

  async function valider() {
    setErreur(null);
    if (pin !== confirmation) {
      setErreur('Les deux codes ne correspondent pas.');
      return;
    }
    setEnCours(true);
    const resultat = await definirPinAction(pin);
    setEnCours(false);
    if (!resultat.ok) {
      setErreur(resultat.message);
      return;
    }
    onTermine();
  }

  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <Label htmlFor="pin-demarrage">Code à 6 chiffres</Label>
          <Input
            id="pin-demarrage"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            placeholder="••••••"
            className="mt-1 tracking-[0.4em]"
          />
        </div>
        <div className="flex-1">
          <Label htmlFor="pin-demarrage-confirmation">Confirmation</Label>
          <Input
            id="pin-demarrage-confirmation"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            maxLength={6}
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value.replace(/\D/g, ''))}
            placeholder="••••••"
            className="mt-1 tracking-[0.4em]"
          />
        </div>
      </div>
      <ErreurEtape message={erreur} />
      <div className="flex justify-end">
        <Button onClick={valider} disabled={enCours || pin.length !== 6}>
          {enCours ? 'Enregistrement…' : 'Enregistrer le code'}
        </Button>
      </div>
    </div>
  );
}

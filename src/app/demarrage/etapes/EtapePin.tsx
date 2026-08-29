'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { appelerAction } from '../appel-action';
import { ErreurEtape } from '../Bulles';
import { definirPinAction } from '../actions';

/**
 * Première étape du parcours, et elle ne peut pas être ailleurs : `exigerPin`
 * lève « Aucun PIN de confirmation n'est configuré » dès qu'on tente
 * d'activer une année ou un cycle. Sans ce code défini d'abord, les deux
 * étapes suivantes seraient bloquées.
 *
 * Le champ est volontairement **en clair et sans confirmation**. Avec deux
 * champs `type="password"`, le gestionnaire de mots de passe du navigateur les
 * remplissait avec le mot de passe du compte ; le filtre ne gardant que les
 * chiffres, « TestOnboarding2026! » devenait « 2026 » — et l'étape échouait sur
 * « les deux codes ne correspondent pas », sans que rien n'atteigne le serveur.
 * Un champ visible que l'on choisit soi-même rend la confirmation inutile et
 * supprime la prise du gestionnaire.
 */
export function EtapePin({ onTermine }: { onTermine: () => void }) {
  const [pin, setPin] = React.useState('');
  const [erreur, setErreur] = React.useState<string | null>(null);
  const [enCours, setEnCours] = React.useState(false);

  async function valider() {
    setErreur(null);
    setEnCours(true);
    const resultat = await appelerAction(() => definirPinAction(pin));
    setEnCours(false);
    if (!resultat.ok) {
      setErreur(resultat.message);
      return;
    }
    onTermine();
  }

  return (
    <div className="mt-4 flex flex-col gap-3">
      <div>
        <Label htmlFor="pin-demarrage">Code à 6 chiffres</Label>
        <Input
          id="pin-demarrage"
          name="code-confirmation"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          data-1p-ignore
          data-lpignore="true"
          maxLength={6}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          placeholder="123456"
          className="mt-1 max-w-[10rem] text-center text-headline-md tracking-[0.5em]"
        />
        <p className="mt-1 text-body-sm text-text-secondary">
          Notez-le : il vous sera redemandé à chaque décision définitive.
          {pin.length > 0 && pin.length < 6 && (
            <span className="text-error"> Encore {6 - pin.length} chiffre{6 - pin.length > 1 ? 's' : ''}.</span>
          )}
        </p>
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

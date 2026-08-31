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
 * Masquage et double saisie, sans rouvrir le bug d'origine. Avec deux champs
 * `type="password"`, le gestionnaire de mots de passe du navigateur les
 * remplissait avec le mot de passe du compte ; le filtre ne gardant que les
 * chiffres, « TestOnboarding2026! » devenait « 2026 », et l'étape échouait sur
 * « les deux codes ne correspondent pas » sans que rien n'atteigne le serveur.
 *
 * Les champs restent donc `type="text"` — les gestionnaires ne ciblent que les
 * vrais champs mot de passe — et le masquage est purement visuel
 * (`.champ-code-secret`, `globals.css`). La confirmation redevient utile dès
 * lors qu'on ne peut plus se relire.
 *
 * Deuxième garde-fou, indépendante de la première : une saisie contenant
 * autre chose que des chiffres est **signalée** au lieu d'être silencieusement
 * tronquée. C'est la troncature muette, pas le masquage, qui rendait la panne
 * initiale indéchiffrable.
 */
export function EtapePin({ onTermine }: { onTermine: () => void }) {
  const [pin, setPin] = React.useState('');
  const [confirmation, setConfirmation] = React.useState('');
  const [erreur, setErreur] = React.useState<string | null>(null);
  const [saisieInvalide, setSaisieInvalide] = React.useState(false);
  const [enCours, setEnCours] = React.useState(false);

  /** Ne garde que les chiffres, mais signale si l'on a dû en retirer. */
  function filtrer(brut: string, appliquer: (v: string) => void) {
    const chiffres = brut.replace(/\D/g, '');
    setSaisieInvalide(chiffres !== brut);
    appliquer(chiffres);
  }

  const complet = pin.length === 6;
  const correspond = complet && pin === confirmation;
  const discordance = complet && confirmation.length === 6 && pin !== confirmation;

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
    <div className="mt-4 flex flex-col gap-4">
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
          onChange={(e) => filtrer(e.target.value, setPin)}
          className="champ-code-secret mt-1 max-w-[10rem] text-center text-headline-md tracking-[0.5em]"
        />
        <p className="mt-1 text-body-sm text-text-secondary">
          Notez-le : il vous sera redemandé à chaque décision définitive.
          {pin.length > 0 && pin.length < 6 && (
            <span className="text-error">
              {' '}
              Encore {6 - pin.length} chiffre{6 - pin.length > 1 ? 's' : ''}.
            </span>
          )}
        </p>
      </div>

      <div>
        <Label htmlFor="pin-demarrage-confirmation">Confirmez le code</Label>
        <Input
          id="pin-demarrage-confirmation"
          name="code-confirmation-repete"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          data-1p-ignore
          data-lpignore="true"
          maxLength={6}
          value={confirmation}
          onChange={(e) => filtrer(e.target.value, setConfirmation)}
          className="champ-code-secret mt-1 max-w-[10rem] text-center text-headline-md tracking-[0.5em]"
        />
        {discordance && (
          <p className="mt-1 text-body-sm text-error">Les deux codes ne correspondent pas.</p>
        )}
      </div>

      {saisieInvalide && (
        <p className="text-body-sm text-error">
          Le code ne peut contenir que des chiffres. Si votre navigateur a rempli le champ
          automatiquement, effacez-le et saisissez votre code.
        </p>
      )}

      <ErreurEtape message={erreur} />
      <div className="flex justify-end">
        <Button onClick={valider} disabled={enCours || !correspond}>
          {enCours ? 'Enregistrement…' : 'Enregistrer le code'}
        </Button>
      </div>
    </div>
  );
}

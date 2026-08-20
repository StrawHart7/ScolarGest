'use client';

import * as React from 'react';
import { ShieldAlert } from 'lucide-react';
import { Input } from './input';
import { Label } from './label';
import { Button, SubmitButton, type ButtonProps } from './button';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog';
import { useToast } from './toast';

/**
 * Confirmation par PIN d'une action irréversible.
 *
 * Le PIN n'était demandé que sur l'approbation des notes, alors que
 * l'activation d'un cycle (définitive) ou le changement d'année active
 * engagent tout autant l'établissement. Ce composant est le point de passage
 * commun côté interface ; la vérification, elle, reste serveur
 * (`exigerPin` dans `services/pin.ts`) — un contrôle d'interface n'est pas
 * une sécurité.
 */
export function ConfirmationPin({
  action,
  declencheur,
  iconeDeclencheur,
  varianteDeclencheur = 'secondary',
  tailleDeclencheur = 'sm',
  titre,
  description,
  consequence,
  libelleValidation = 'Confirmer',
  messageSucces,
  champsCaches,
  desactive,
}: {
  /** Reçoit le PIN saisi ; renvoie `null` en cas de succès, un message sinon. */
  action: (pin: string, donnees: FormData) => Promise<string | null>;
  declencheur: string;
  iconeDeclencheur?: React.ReactNode;
  varianteDeclencheur?: ButtonProps['variant'];
  tailleDeclencheur?: ButtonProps['size'];
  titre: string;
  description: string;
  /** Ce que l'action rend irréversible. Affiché en encart d'avertissement. */
  consequence?: string;
  libelleValidation?: string;
  messageSucces: string;
  champsCaches?: Record<string, string>;
  desactive?: boolean;
}) {
  const [ouvert, setOuvert] = React.useState(false);
  const [erreurPin, setErreurPin] = React.useState<string | null>(null);
  const { succes, erreur } = useToast();

  const soumettre = async (donnees: FormData) => {
    const pin = String(donnees.get('pin') ?? '');
    setErreurPin(null);
    const message = await action(pin, donnees);
    if (message === null) {
      setOuvert(false);
      succes(messageSucces);
    } else {
      setErreurPin(message);
      erreur('Action refusée', message);
    }
  };

  return (
    <Dialog
      open={ouvert}
      onOpenChange={(etat) => {
        setOuvert(etat);
        if (!etat) setErreurPin(null);
      }}
    >
      <Button
        variant={varianteDeclencheur}
        size={tailleDeclencheur}
        disabled={desactive}
        onClick={() => setOuvert(true)}
      >
        {iconeDeclencheur}
        {declencheur}
      </Button>

      <DialogContent taille="sm">
        <form action={soumettre}>
          {Object.entries(champsCaches ?? {}).map(([nom, valeur]) => (
            <input key={nom} type="hidden" name={nom} value={valeur} />
          ))}

          <DialogHeader>
            <DialogTitle>{titre}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <DialogBody>
            {consequence && (
              <div className="flex items-start gap-3 rounded border border-error/30 bg-error-container/40 p-3">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-error" aria-hidden />
                <p className="text-body-sm text-text-primary">{consequence}</p>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pin">PIN de confirmation</Label>
              <Input
                id="pin"
                name="pin"
                type="password"
                inputMode="numeric"
                maxLength={6}
                pattern="\d{6}"
                autoComplete="off"
                required
                autoFocus
              />
              {erreurPin && <p className="text-body-sm text-error">{erreurPin}</p>}
            </div>
          </DialogBody>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost" size="sm">
                Annuler
              </Button>
            </DialogClose>
            <SubmitButton size="sm" libelleEnCours="Vérification…">
              {libelleValidation}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

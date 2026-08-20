'use client';

import * as React from 'react';
import { useFormState } from 'react-dom';
import { KeyRound, ShieldCheck, ShieldAlert } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button, SubmitButton } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { definirPinAction } from './actions';

/**
 * Le PIN d'approbation occupait une carte entière avec ses deux champs à nu,
 * alors qu'on le change une fois par an. Il devient une ligne discrète, et la
 * saisie se fait dans un modal.
 */
export function PinForm({ pinConfigure }: { pinConfigure: boolean }) {
  const [resultat, formAction] = useFormState(definirPinAction, null);
  const [ouvert, setOuvert] = React.useState(false);
  const { succes, erreur } = useToast();
  const dernierResultat = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!resultat || resultat === dernierResultat.current) return;
    dernierResultat.current = resultat;
    if (resultat === 'OK') {
      setOuvert(false);
      succes('PIN mis à jour', 'Il sera demandé lors des prochaines actions sensibles.');
    } else {
      erreur('PIN non enregistré', resultat);
    }
  }, [resultat, succes, erreur]);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-surface-border bg-surface-container-lowest px-5 py-4">
      <span
        className={
          pinConfigure
            ? 'grid h-9 w-9 place-items-center rounded-full bg-tertiary-container/15 text-tertiary-container'
            : 'grid h-9 w-9 place-items-center rounded-full bg-error-container text-error-on-container'
        }
      >
        {pinConfigure ? (
          <ShieldCheck className="h-[18px] w-[18px]" aria-hidden />
        ) : (
          <ShieldAlert className="h-[18px] w-[18px]" aria-hidden />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-body-md text-text-primary">PIN de confirmation</p>
        <p className="text-body-sm text-text-secondary">
          {pinConfigure
            ? 'Configuré. Il est demandé avant chaque action sensible.'
            : "Non configuré. Les actions d'approbation resteront bloquées."}
        </p>
      </div>

      <Dialog open={ouvert} onOpenChange={setOuvert}>
        <Button variant="secondary" size="sm" onClick={() => setOuvert(true)}>
          <KeyRound className="h-4 w-4" aria-hidden />
          {pinConfigure ? 'Modifier' : 'Définir'}
        </Button>

        <DialogContent taille="sm">
          <form action={formAction}>
            <DialogHeader>
              <DialogTitle>{pinConfigure ? 'Modifier le PIN' : 'Définir le PIN'}</DialogTitle>
              <DialogDescription>
                Six chiffres. Il vous sera demandé pour approuver des notes, activer une année
                scolaire ou verrouiller un cycle.
              </DialogDescription>
            </DialogHeader>

            <DialogBody>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pin">Nouveau PIN</Label>
                <Input
                  id="pin"
                  name="pin"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  pattern="\d{6}"
                  autoComplete="new-password"
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
                  autoComplete="new-password"
                  required
                />
              </div>
            </DialogBody>

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost" size="sm">
                  Annuler
                </Button>
              </DialogClose>
              <SubmitButton size="sm" libelleEnCours="Enregistrement…">
                Enregistrer le PIN
              </SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

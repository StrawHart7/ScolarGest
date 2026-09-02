'use client';

import * as React from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CATEGORIES_SUPPORT } from '@/services/support';
import { envoyerDemandeSupportAction, type ResultatSupport } from './actions';

const initial: ResultatSupport = { ok: false, message: '' };

function BoutonEnvoyer() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Envoi en cours…' : 'Envoyer au support'}
    </Button>
  );
}

/**
 * Formulaire de contact du support.
 *
 * `pageOrigine` est renseigné automatiquement depuis le paramètre `?depuis=`
 * de l'URL. Sans lui, une demande sur deux commence par un aller-retour
 * « sur quel écran étiez-vous ? ». C'est une information que l'utilisateur
 * décrit mal et que le navigateur connaît déjà.
 */
export function FormulaireSupport({ pageOrigine }: { pageOrigine: string | null }) {
  const [etat, action] = useFormState(envoyerDemandeSupportAction, initial);
  const [cle, setCle] = React.useState(0);

  // Le formulaire est remonté à vide après un envoi réussi, mais conservé tel
  // quel après un échec : une saisie de trente lignes perdue sur une coupure
  // réseau ne se retape pas, elle fait abandonner.
  React.useEffect(() => {
    if (etat.ok) setCle((k) => k + 1);
  }, [etat.ok]);

  return (
    <form key={cle} action={action} className="space-y-4">
      {pageOrigine && <input type="hidden" name="pageOrigine" value={pageOrigine} />}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="categorie">Sujet concerné</Label>
        <Select name="categorie" defaultValue="AUTRE" required>
          <SelectTrigger id="categorie">
            <SelectValue placeholder="Choisir" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES_SUPPORT.map((c) => (
              <SelectItem key={c.valeur} value={c.valeur}>
                {c.libelle}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sujet">Résumé</Label>
        <Input
          id="sujet"
          name="sujet"
          required
          maxLength={150}
          placeholder="Ex. : impossible de valider les notes de la 4ème B"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="message">Description</Label>
        <textarea
          id="message"
          name="message"
          rows={6}
          required
          maxLength={4000}
          placeholder="Ce que vous faisiez, ce que vous attendiez, ce qui s’est passé. Indiquez la classe, l’élève ou la facture concernée si cela s’y prête."
          className="flex w-full rounded border border-surface-border bg-surface-container-lowest px-3 py-2 text-body-md text-text-primary placeholder:text-text-secondary/60 focus-visible:border-primary-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container/20"
        />
      </div>

      {etat.message &&
        (etat.ok ? (
          <p className="flex items-start gap-2 rounded-lg border border-tertiary/30 bg-tertiary-fixed/40 p-3 text-body-sm text-text-primary">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-tertiary" aria-hidden />
            {etat.message}
          </p>
        ) : (
          <p className="text-body-sm text-error">{etat.message}</p>
        ))}

      <BoutonEnvoyer />
    </form>
  );
}

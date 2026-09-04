'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Button } from '@/components/ui/button';
import { ouvrirPeriodeAction } from '../actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? 'Création...' : 'Ouvrir la période'}
    </Button>
  );
}

export function AbonnementForm({
  etablissements,
  plans,
}: {
  etablissements: { id: string; nom: string }[];
  plans: { id: string; nom: string; prix: number; duree: string; parCycle: boolean }[];
}) {
  const [error, formAction] = useFormState(ouvrirPeriodeAction, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="etablissementId">Établissement</Label>
        <Select name="etablissementId" required>
          <SelectTrigger id="etablissementId">
            <SelectValue placeholder="Choisir un établissement" />
          </SelectTrigger>
          <SelectContent>
            {etablissements.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.nom}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/*
        La nature du plan est dite dans le libelle, pas devinee. Le catalogue
        public se multiplie par le nombre de cycles ; le plan fondateur est un
        forfait par etablissement. Saisir « 2 cycles » sur un forfait doublerait
        la facture d'une ecole a qui l'on a promis un prix garanti, et personne
        ne s'en apercevrait avant le releve.
      */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="planId">Plan</Label>
        <Select name="planId" required>
          <SelectTrigger id="planId">
            <SelectValue placeholder="Choisir un plan" />
          </SelectTrigger>
          <SelectContent>
            {plans.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.nom} — {Number(p.prix).toLocaleString('fr-FR')} FCFA / {p.duree}
                {p.parCycle ? ' par cycle' : ' forfait'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Le nombre de cycles et le montant sont obligatoires. Sans eux, la
          console plateforme affichait un revenu faux : trois abonnements en
          base portaient un montant nul ou incohérent avec le catalogue. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nombreCycles">Cycles facturés</Label>
          {/* Un plan forfaitaire ne se multiplie pas : le rappeler ici evite
              qu'un complexe fondateur soit facture deux fois son forfait. */}
          <Input
            id="nombreCycles"
            name="nombreCycles"
            type="number"
            inputMode="numeric"
            min={1}
            defaultValue={1}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="montantTotal">Montant facturé (FCFA)</Label>
          <Input
            id="montantTotal"
            name="montantTotal"
            type="number"
            inputMode="numeric"
            min={0}
            required
          />
          <p className="text-body-sm text-text-secondary">
            Zéro pour une période offerte : le motif devient alors obligatoire.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dateDebut">Date de début (facultative)</Label>
          <DatePicker id="dateDebut" name="dateDebut" />
          <p className="text-body-sm text-text-secondary">
            Par défaut, la période enchaîne sur l&apos;essai et sur l&apos;abonnement en cours.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="modePaiement">Mode de règlement</Label>
          <Select name="modePaiement">
            <SelectTrigger id="modePaiement">
              <SelectValue placeholder="Aucun (période offerte)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ESPECES">Espèces</SelectItem>
              <SelectItem value="CHEQUE">Chèque</SelectItem>
              <SelectItem value="VIREMENT">Virement</SelectItem>
              <SelectItem value="MOBILE_MONEY">Mobile Money</SelectItem>
              <SelectItem value="AUTRE">Autre</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reference">Référence du règlement</Label>
          <Input id="reference" name="reference" placeholder="Numéro de reçu, de virement…" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="motif">Motif</Label>
          <Input id="motif" name="motif" placeholder="École pilote, geste commercial…" />
        </div>
      </div>

      {error && <p className="text-body-sm text-error">{error}</p>}
      <SubmitButton />
    </form>
  );
}

'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useConnectivity } from '@/components/connectivity/connectivity-context';
import { useSynchronisation } from '@/components/offline/synchronisation-context';
import { enregistrerVersementAction } from './actions';

const MODES = [
  { value: 'ESPECES', label: 'Espèces' },
  { value: 'MOBILE_MONEY', label: 'Mobile Money' },
  { value: 'VIREMENT', label: 'Virement' },
  { value: 'CHEQUE', label: 'Chèque' },
  { value: 'AUTRE', label: 'Autre' },
];

function SubmitButton({ horsLigne }: { horsLigne: boolean }) {
  const { pending } = useFormStatus();
  // Le libelle dit ce qui va se passer, pas ce que le systeme fait : hors
  // ligne, l'argent n'est pas encaisse tant que rien n'est parti au serveur.
  // Ecrire « Valider l'encaissement » ferait croire l'operation terminee.
  const libelle = horsLigne ? "Mettre l'encaissement en attente" : "Valider l'encaissement";
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Enregistrement...' : libelle}
    </Button>
  );
}

export function NouveauVersementForm({
  factureId,
  solde,
}: {
  factureId: string;
  solde: number;
}) {
  const [error, formAction] = useFormState(enregistrerVersementAction, null);
  const [mode, setMode] = useState('ESPECES');
  const [misEnFile, setMisEnFile] = useState(false);
  const referenceRequise = mode !== 'ESPECES';
  const aujourdhui = new Date().toISOString().slice(0, 10);

  const { enLigne } = useConnectivity();
  const sync = useSynchronisation();
  const horsLigne = !enLigne && sync !== null;

  /**
   * Hors ligne, l'encaissement part en file plutot que d'echouer.
   *
   * La cle d'idempotence n'est posee **que** dans ce cas. Une cle attachee a
   * une saisie en ligne survivrait au rendu suivant, et le versement suivant
   * saisi dans le meme formulaire serait pris pour un rejeu du precedent :
   * l'argent serait avale en silence. Le double-clic en ligne reste donc
   * couvert comme avant, pas davantage — c'est un chantier a part.
   */
  async function soumettre(donnees: FormData) {
    if (!horsLigne || !sync) {
      formAction(donnees);
      return;
    }
    const montant = Number(donnees.get('montant') ?? 0);
    await sync.mettreEnFile({
      type: 'PAIEMENT',
      charge: {
        factureId: String(donnees.get('factureId') ?? ''),
        montant: String(donnees.get('montant') ?? ''),
        modePaiement: String(donnees.get('modePaiement') ?? ''),
        reference: String(donnees.get('reference') ?? ''),
        datePaiement: String(donnees.get('datePaiement') ?? ''),
      },
      intitule: `Versement de ${montant.toLocaleString('fr-FR')} FCFA`,
    });
    setMisEnFile(true);
  }

  return (
    <form action={soumettre} className="space-y-4">
      <input type="hidden" name="factureId" value={factureId} />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="montant">Montant à encaisser (FCFA)</Label>
          <Input
            id="montant"
            name="montant"
            type="number" inputMode="numeric"
            min={1}
            max={solde}
            step={1}
            placeholder="0"
            required
          />
          <p className="text-body-sm text-text-secondary">
            Reste dû : {solde.toLocaleString('fr-FR')} FCFA
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="datePaiement">Date du versement</Label>
          <DatePicker id="datePaiement" name="datePaiement" defaultValue={aujourdhui} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="modePaiement">Mode de paiement</Label>
          <Select name="modePaiement" value={mode} onValueChange={setMode}>
            <SelectTrigger id="modePaiement">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODES.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reference">Référence de transaction</Label>
          <Input
            id="reference"
            name="reference"
            placeholder="Ex : CHQ-00123 ou TXN-987"
            required={referenceRequise}
          />
          <p className="text-body-sm text-text-secondary">
            {referenceRequise
              ? 'Requise pour un chèque, un virement ou un Mobile Money.'
              : 'Facultative pour un encaissement en espèces.'}
          </p>
        </div>
      </div>

      {horsLigne && !misEnFile && (
        <p className="rounded-xl bg-warning-container px-4 py-3 text-body-sm text-text-primary">
          Vous etes hors connexion. L&apos;encaissement sera enregistre sur cet appareil et
          envoye des le retour du reseau. Le recu ne pourra etre edite qu&apos;a ce
          moment-la.
        </p>
      )}

      {misEnFile && (
        <p className="rounded-xl bg-success-container px-4 py-3 text-body-sm text-text-primary">
          Encaissement mis en attente. Il partira automatiquement des que la connexion
          reviendra. Ne vous deconnectez pas avant : les ecritures en attente seraient
          perdues.
        </p>
      )}

      <div className="flex items-center gap-3">
        <SubmitButton horsLigne={horsLigne} />
        {error && <p className="text-body-sm text-error">{error}</p>}
      </div>
    </form>
  );
}

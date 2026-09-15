'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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

function SubmitButton({ horsLigne, fige }: { horsLigne: boolean; fige: boolean }) {
  const { pending } = useFormStatus();
  // Le libelle dit ce qui va se passer, pas ce que le systeme fait : hors
  // ligne, l'argent n'est pas encaisse tant que rien n'est parti au serveur.
  // Ecrire « Valider l'encaissement » ferait croire l'operation terminee.
  const libelle = horsLigne ? "Mettre l'encaissement en attente" : "Valider l'encaissement";
  return (
    // `fige` : l'ecriture a ete deposee, donc elle existe. Un second clic ne
    // rattraperait rien — il encaisserait une seconde fois. C'est exactement
    // ce qui s'est produit le 2026-09-13.
    <Button type="submit" disabled={pending || fige}>
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
  const router = useRouter();
  const [error, formAction] = useFormState(enregistrerVersementAction, null);
  const [mode, setMode] = useState('ESPECES');
  // `null` tant que rien n'a ete depose. Ensuite l'ecriture existe, et le
  // formulaire ne doit plus pouvoir en produire une seconde.
  const [misEnFile, setMisEnFile] = useState<'envoye' | 'enAttente' | null>(null);
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
   *
   * ## Ce qui a change le 2026-09-13, apres un encaissement double
   *
   * `mettreEnFile` tente desormais l'envoi tout de suite et dit s'il est passe.
   * Deux consequences ici :
   *
   * - **Le message ne ment plus.** Annoncer « mis en attente » pour une
   *   ecriture deja enregistree etait la cause directe du doublon : la
   *   Comptable a conclu que rien n'etait parti et a resoumis.
   * - **Le formulaire se verrouille.** Une fois l'ecriture deposee — envoyee ou
   *   non — elle **existe**. Resoumettre n'est jamais un rattrapage, c'est
   *   toujours un second versement. Le bouton se ferme donc, et la page se
   *   recharge quand l'encaissement est confirme, pour montrer le nouveau
   *   solde plutot que de demander de le croire.
   */
  async function soumettre(donnees: FormData) {
    if (!horsLigne || !sync) {
      formAction(donnees);
      return;
    }
    const montant = Number(donnees.get('montant') ?? 0);
    const { envoyee } = await sync.mettreEnFile({
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
    setMisEnFile(envoyee ? 'envoye' : 'enAttente');
    // Le serveur a bien enregistre : on montre le solde a jour. Sans cela
    // l'ecran continue d'afficher l'ancien, ce qui est exactement le doute
    // qui fait recliquer.
    if (envoyee) router.refresh();
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

      {misEnFile === 'envoye' && (
        // `bg-success-container` n'existait nulle part : `success` n'est pas
        // declare dans `tailwind.config.ts`, la classe n'etait donc generee par
        // personne et ce message s'affichait **sans fond**, texte noir sur
        // blanc, a l'endroit exact ou il devait se distinguer de la page.
        // Jumeau du `bg-warning-container` deja corrige, dont le commentaire
        // est reste dans la config.
        //
        // La couleur de succes de ce systeme est `tertiary` — c'est ce
        // qu'emploie `Badge variant="success"`. On applique la convention
        // existante plutot que d'ajouter une famille de tokens pour un seul
        // usage.
        <p className="rounded-xl border border-tertiary/25 bg-tertiary/10 px-4 py-3 text-body-sm text-text-primary">
          Encaissement enregistre. Le solde ci-contre est a jour.
        </p>
      )}

      {misEnFile === 'enAttente' && (
        <p className="rounded-xl bg-warning-container px-4 py-3 text-body-sm text-text-primary">
          Encaissement mis en attente : le serveur n&apos;a pas repondu. Il partira tout seul des
          que la connexion reviendra, et le bandeau en haut de l&apos;ecran le suit. Ne le
          resaisissez pas — il serait encaisse deux fois — et ne vous deconnectez pas avant :
          les ecritures en attente seraient perdues.
        </p>
      )}

      <div className="flex items-center gap-3">
        <SubmitButton horsLigne={horsLigne} fige={misEnFile !== null} />
        {error && <p className="text-body-sm text-error">{error}</p>}
      </div>
    </form>
  );
}

'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Button } from '@/components/ui/button';
import { BarreAction } from '@/components/tactile/barre-action';
import { creerEnseignant } from './actions';

function SubmitButton({ pleineLargeur }: { pleineLargeur?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="lg"
      disabled={pending}
      className={pleineLargeur ? 'w-full' : undefined}
    >
      {pending ? 'Enregistrement...' : "Enregistrer l'enseignant"}
    </Button>
  );
}

export function EnseignantForm({ anneeScolaireId }: { anneeScolaireId: string }) {
  const [error, formAction] = useFormState(creerEnseignant, null);

  const [nom, setNom] = useState('');
  const [prenoms, setPrenoms] = useState('');
  const [sexe, setSexe] = useState<'M' | 'F' | ''>('');
  const [email, setEmail] = useState('');
  const [telephone, setTelephone] = useState('');
  const [adresse, setAdresse] = useState('');
  const [ancienMatricule, setAncienMatricule] = useState('');
  const [statut, setStatut] = useState<'ACTIF' | 'INACTIF' | 'CONGE' | 'DEPART'>('ACTIF');

  const payload = JSON.stringify({
    nom,
    prenoms,
    sexe: sexe || undefined,
    email,
    telephone: telephone || undefined,
    adresse: adresse || undefined,
    ancienMatricule: ancienMatricule || undefined,
    statut,
    // dateNaissance et dateEmbauche sont soumis séparément via les hidden
    // inputs des DatePicker (name="dateNaissance" / "dateEmbauche") et
    // fusionnés côté serveur — voir actions.ts.
    anneeScolaireIdPourMatricule: anneeScolaireId,
  });

  return (
    <form action={formAction} className="flex flex-col gap-6 pb-zone-action md:pb-0">
      <input type="hidden" name="payload" value={payload} />

      <section className="flex flex-col gap-4 rounded-lg border border-surface-border p-4">
        <h3 className="text-headline-sm text-text-primary">Identité de l&apos;enseignant</h3>
        <div className="grid grid-cols-1 gap-gutter md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nom">Nom de famille</Label>
            <Input id="nom" value={nom} onChange={(e) => setNom(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="prenoms">Prénoms</Label>
            <Input id="prenoms" value={prenoms} onChange={(e) => setPrenoms(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sexe">Sexe</Label>
            <Select value={sexe} onValueChange={(v) => setSexe(v as 'M' | 'F')}>
              <SelectTrigger id="sexe">
                <SelectValue placeholder="Sélectionner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="M">Masculin</SelectItem>
                <SelectItem value="F">Féminin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dateNaissance">Date de naissance</Label>
            <DatePicker id="dateNaissance" name="dateNaissance" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="telephone">Téléphone</Label>
            <Input
              id="telephone"
              value={telephone}
              onChange={(e) => setTelephone(e.target.value)}
              placeholder="+228 90 00 00 00"
            />
          </div>
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <div className="flex items-start gap-2 rounded-md bg-primary-container/10 p-3 text-body-sm text-text-secondary">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary-container" aria-hidden />
              <p>Une invitation par email sera envoyée à l&apos;enseignant pour créer son compte.</p>
            </div>
          </div>
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <Label htmlFor="adresse">Adresse</Label>
            <Input id="adresse" value={adresse} onChange={(e) => setAdresse(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dateEmbauche">Date d&apos;embauche</Label>
            <DatePicker id="dateEmbauche" name="dateEmbauche" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="statut">Statut initial</Label>
            <Select value={statut} onValueChange={(v) => setStatut(v as typeof statut)}>
              <SelectTrigger id="statut">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIF">Actif</SelectItem>
                <SelectItem value="INACTIF">Inactif</SelectItem>
                <SelectItem value="CONGE">Congé</SelectItem>
                <SelectItem value="DEPART">Départ</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <Label htmlFor="ancienMatricule">Ancien matricule (le cas échéant)</Label>
            <Input
              id="ancienMatricule"
              value={ancienMatricule}
              onChange={(e) => setAncienMatricule(e.target.value)}
            />
          </div>
        </div>
      </section>

      {error && <p className="text-body-sm text-error">{error}</p>}
      {/* Masqué sous `md`, où la barre collée prend le relais. Voir
          `BarreAction` : on double la soumission, on ne la déplace pas. */}
      <div className="hidden justify-end gap-3 border-t border-surface-border pt-6 md:flex">
        <SubmitButton />
      </div>

      <BarreAction aide="Vous pourrez affecter des classes après l’enregistrement.">
        <SubmitButton pleineLargeur />
      </BarreAction>
    </form>
  );
}

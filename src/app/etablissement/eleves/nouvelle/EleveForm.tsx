'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { creerEleve } from './actions';

interface ResponsableDraft {
  nom: string;
  prenoms: string;
  telephone: string;
  email: string;
  profession: string;
  type: 'PERE' | 'MERE' | 'TUTEUR' | 'AUTRE';
  lienParente: string;
  principal: boolean;
}

function newResponsable(principal: boolean): ResponsableDraft {
  return {
    nom: '',
    prenoms: '',
    telephone: '',
    email: '',
    profession: '',
    type: 'PERE',
    lienParente: '',
    principal,
  };
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? 'Enregistrement...' : "Enregistrer l'élève"}
    </Button>
  );
}

export function EleveForm({ anneeScolaireId }: { anneeScolaireId: string }) {
  const [error, formAction] = useFormState(creerEleve, null);

  const [nom, setNom] = useState('');
  const [prenoms, setPrenoms] = useState('');
  const [sexe, setSexe] = useState<'M' | 'F' | ''>('');
  const [lieuNaissance, setLieuNaissance] = useState('');
  const [nationalite, setNationalite] = useState('');
  const [ancienMatricule, setAncienMatricule] = useState('');
  const [responsables, setResponsables] = useState<ResponsableDraft[]>([newResponsable(true)]);

  function updateResponsable(index: number, patch: Partial<ResponsableDraft>) {
    setResponsables((prev) =>
      prev.map((r, i) => {
        if (i !== index) {
          // Un seul principal=true côté formulaire : si l'index courant devient
          // principal, désactive les autres immédiatement (aperçu client — la
          // garantie définitive reste portée par la RPC côté serveur).
          if (patch.principal === true) return { ...r, principal: false };
          return r;
        }
        return { ...r, ...patch };
      }),
    );
  }

  function addResponsable() {
    setResponsables((prev) => [...prev, newResponsable(false)]);
  }

  function removeResponsable(index: number) {
    setResponsables((prev) => prev.filter((_, i) => i !== index));
  }

  const payload = JSON.stringify({
    nom,
    prenoms,
    sexe: sexe || undefined,
    lieuNaissance: lieuNaissance || undefined,
    nationalite: nationalite || undefined,
    ancienMatricule: ancienMatricule || undefined,
    // dateNaissance is submitted separately via the DatePicker's own hidden
    // input (name="dateNaissance") and merged server-side — see actions.ts.
    anneeScolaireIdPourMatricule: anneeScolaireId,
    responsables: responsables.map((r) => ({
      ...r,
      email: r.email || undefined,
      telephone: r.telephone || undefined,
      profession: r.profession || undefined,
    })),
  });

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="payload" value={payload} />

      <section className="flex flex-col gap-4 rounded-lg border border-surface-border p-4">
        <h3 className="text-headline-sm text-text-primary">Identité de l&apos;élève</h3>
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
            <Label htmlFor="dateNaissance">Date de naissance</Label>
            <DatePicker id="dateNaissance" name="dateNaissance" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lieuNaissance">Lieu de naissance</Label>
            <Input id="lieuNaissance" value={lieuNaissance} onChange={(e) => setLieuNaissance(e.target.value)} />
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
            <Label htmlFor="nationalite">Nationalité</Label>
            <Input id="nationalite" value={nationalite} onChange={(e) => setNationalite(e.target.value)} />
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

      <section className="flex flex-col gap-4 rounded-lg border border-surface-border p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-headline-sm text-text-primary">Responsables légaux</h3>
          <Button type="button" variant="secondary" size="sm" onClick={addResponsable}>
            <Plus className="h-4 w-4" aria-hidden />
            Ajouter un responsable
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-gutter md:grid-cols-2">
          {responsables.map((r, index) => (
            <div key={index} className="space-y-4 rounded-lg border border-surface-border bg-surface p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`principal-${index}`}
                    checked={r.principal}
                    onCheckedChange={(checked) => updateResponsable(index, { principal: checked === true })}
                  />
                  <Label htmlFor={`principal-${index}`} className="normal-case">
                    Responsable principal
                  </Label>
                </div>
                {responsables.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeResponsable(index)}
                    className="text-text-secondary hover:text-error"
                    aria-label="Retirer ce responsable"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Type</Label>
                <Select
                  value={r.type}
                  onValueChange={(v) => updateResponsable(index, { type: v as ResponsableDraft['type'] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERE">Père</SelectItem>
                    <SelectItem value="MERE">Mère</SelectItem>
                    <SelectItem value="TUTEUR">Tuteur</SelectItem>
                    <SelectItem value="AUTRE">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Lien de parenté</Label>
                <Input
                  value={r.lienParente}
                  onChange={(e) => updateResponsable(index, { lienParente: e.target.value })}
                  placeholder="Ex: Père, Mère, Oncle..."
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Nom complet</Label>
                <Input
                  value={r.nom}
                  onChange={(e) => updateResponsable(index, { nom: e.target.value })}
                  placeholder="Nom"
                  required
                />
                <Input
                  value={r.prenoms}
                  onChange={(e) => updateResponsable(index, { prenoms: e.target.value })}
                  placeholder="Prénoms"
                  required
                  className="mt-1.5"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Téléphone</Label>
                <Input
                  value={r.telephone}
                  onChange={(e) => updateResponsable(index, { telephone: e.target.value })}
                  placeholder="+228 90 00 00 00"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={r.email}
                  onChange={(e) => updateResponsable(index, { email: e.target.value })}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Profession</Label>
                <Input
                  value={r.profession}
                  onChange={(e) => updateResponsable(index, { profession: e.target.value })}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {error && <p className="text-body-sm text-error">{error}</p>}
      <div className="flex justify-end gap-3 border-t border-surface-border pt-6">
        <SubmitButton />
      </div>
    </form>
  );
}

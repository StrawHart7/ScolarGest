'use client';

import { useState, useTransition } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { creerAffectationAction, creerMatiereAction } from './actions';

interface Option {
  id: string;
  nom: string;
}

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function AffectationForm({
  enseignantId,
  anneeScolaireId,
  classes,
  matieres,
}: {
  enseignantId: string;
  anneeScolaireId: string;
  classes: Option[];
  matieres: Option[];
}) {
  const [error, formAction] = useFormState(creerAffectationAction, null);
  const [classeId, setClasseId] = useState('');
  const [matiereId, setMatiereId] = useState('');
  const [showMatiereForm, setShowMatiereForm] = useState(false);

  const [matiereError, matiereFormAction] = useFormState(creerMatiereAction, null);

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-3">
        <input type="hidden" name="anneeScolaireId" value={anneeScolaireId} />
        <input type="hidden" name="enseignantId" value={enseignantId} />

        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="classeId">Classe</Label>
          <Select name="classeId" value={classeId} onValueChange={setClasseId} required>
            <SelectTrigger id="classeId">
              <SelectValue placeholder="Choisir une classe" />
            </SelectTrigger>
            <SelectContent>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="matiereId">Matière</Label>
          <Select name="matiereId" value={matiereId} onValueChange={setMatiereId} required>
            <SelectTrigger id="matiereId">
              <SelectValue placeholder="Choisir une matière" />
            </SelectTrigger>
            <SelectContent>
              {matieres.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <SubmitButton label="Ajouter l'affectation" pendingLabel="Ajout..." />
      </form>
      {error && <p className="text-body-sm text-error">{error}</p>}

      {showMatiereForm ? (
        <form action={matiereFormAction} className="flex flex-col gap-3 rounded-lg border border-surface-border p-4 sm:flex-row sm:items-end sm:gap-3">
          <input type="hidden" name="enseignantId" value={enseignantId} />
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="nomMatiere">Nom de la nouvelle matière</Label>
            <Input id="nomMatiere" name="nom" placeholder="Ex: Histoire-Géographie" required />
          </div>
          <div className="flex gap-2">
            <SubmitButton label="Créer" pendingLabel="Création..." />
            <Button type="button" variant="secondary" onClick={() => setShowMatiereForm(false)}>
              Annuler
            </Button>
          </div>
        </form>
      ) : (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="self-start"
          onClick={() => setShowMatiereForm(true)}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Nouvelle matière
        </Button>
      )}
      {matiereError && <p className="text-body-sm text-error">{matiereError}</p>}
    </div>
  );
}

export function SupprimerAffectationButton({
  enseignantId,
  affectationId,
  action,
}: {
  enseignantId: string;
  affectationId: string;
  action: (enseignantId: string, affectationId: string) => Promise<string | null>;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="destructive"
        size="sm"
        disabled={pending}
        onClick={() => {
          if (!window.confirm("Retirer cette affectation ?")) return;
          startTransition(async () => {
            const result = await action(enseignantId, affectationId);
            setError(result);
          });
        }}
      >
        Retirer
      </Button>
      {error && <p className="text-body-sm text-error">{error}</p>}
    </div>
  );
}

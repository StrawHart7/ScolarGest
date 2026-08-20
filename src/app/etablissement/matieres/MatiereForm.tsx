'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormulaireModal } from '@/components/ui/form-modal';
import { creerMatiereAction } from './actions';

export function MatiereForm() {
  return (
    <FormulaireModal
      action={creerMatiereAction}
      titre="Nouvelle matière"
      description="La matière alimente le programme des niveaux et les affectations d’enseignants."
      declencheur="Nouvelle matière"
      libelleValidation="Ajouter la matière"
      messageSucces="Matière créée"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="nom">Nom</Label>
        <Input id="nom" name="nom" placeholder="Mathématiques" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="code">Code</Label>
        <Input id="code" name="code" placeholder="MATH" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Description</Label>
        <Input id="description" name="description" placeholder="Optionnel" />
      </div>
    </FormulaireModal>
  );
}

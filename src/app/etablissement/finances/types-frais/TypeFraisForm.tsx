'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormulaireModal } from '@/components/ui/form-modal';
import { creerTypeFraisAction } from './actions';

export function TypeFraisForm() {
  return (
    <FormulaireModal
      action={creerTypeFraisAction}
      titre="Nouveau type de frais"
      description="Une catégorie facturable. Son montant se définit ensuite classe par classe, dans les tarifs."
      declencheur="Nouveau type de frais"
      libelleValidation="Ajouter le type de frais"
      messageSucces="Type de frais créé"
      detailSucces="Définissez maintenant son tarif par classe."
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="nom">Libellé</Label>
        <Input id="nom" name="nom" placeholder="Scolarité 1er trimestre" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Description</Label>
        <Input id="description" name="description" placeholder="Optionnel" />
      </div>
    </FormulaireModal>
  );
}
